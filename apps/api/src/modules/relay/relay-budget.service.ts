import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import type { MerchantTier } from '@strimz/db'

import { TypedConfigService } from '../../config/index.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

export const RELAY_DAILY_QUOTA: Readonly<Record<MerchantTier, number>> = {
  free: 500,
  growth: 5_000,
  business: 50_000,
  enterprise: 50_000,
}

export const RELAY_BUDGET_WARN_RATIO = 0.8

const MS_PER_DAY = 86_400_000

type BudgetAlert = 'warned' | 'exhausted'

interface UsageRow {
  submissions: number
  warnedAt: Date | null
  exhaustedAt: Date | null
}

function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

function secondsToNextUtcMidnight(at: Date): number {
  const nextMidnight = Math.floor(at.getTime() / MS_PER_DAY) * MS_PER_DAY + MS_PER_DAY
  return Math.ceil((nextMidnight - at.getTime()) / 1000)
}

@Injectable()
export class RelayBudgetService {
  private readonly log = new Logger(RelayBudgetService.name)
  private readonly alertEmail: string | undefined

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    cfg: TypedConfigService,
  ) {
    this.alertEmail = cfg.env.OPS_ALERT_EMAIL
  }

  async consume(merchantId: string, now = new Date()): Promise<void> {
    const merchant = await this.prisma.db.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: { tier: true },
    })
    const quota = RELAY_DAILY_QUOTA[merchant.tier]
    const day = utcDay(now)
    const [row] = await this.prisma.db.$queryRawUnsafe<UsageRow[]>(
      `INSERT INTO "RelayDailyUsage" ("merchantId", "day", "submissions", "updatedAt")
       VALUES ($1, $2::date, 1, $3::timestamp)
       ON CONFLICT ("merchantId", "day") DO UPDATE
         SET "submissions" = "RelayDailyUsage"."submissions" + 1, "updatedAt" = $3::timestamp
         WHERE "RelayDailyUsage"."submissions" < $4
       RETURNING "submissions", "warnedAt", "exhaustedAt"`,
      merchantId,
      day,
      now.toISOString(),
      quota,
    )
    if (!row) {
      throw new HttpException(
        {
          code: 'relay_budget_exhausted',
          message: `the daily relay budget of ${quota} submissions is spent; it resets at 00:00 UTC`,
          details: { quota, retryAfterSec: secondsToNextUtcMidnight(now) },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    if (row.submissions >= quota && row.exhaustedAt === null) {
      await this.alertOnce(merchantId, day, 'exhausted', row.submissions, quota, now)
    } else if (
      row.submissions >= Math.ceil(quota * RELAY_BUDGET_WARN_RATIO) &&
      row.warnedAt === null
    ) {
      await this.alertOnce(merchantId, day, 'warned', row.submissions, quota, now)
    }
  }

  async recordGas(merchantId: string, gasWei: bigint, now = new Date()): Promise<void> {
    await this.prisma.db.$executeRawUnsafe(
      `INSERT INTO "RelayDailyUsage" ("merchantId", "day", "gasUsedWei", "updatedAt")
       VALUES ($1, $2::date, $3::numeric, $4::timestamp)
       ON CONFLICT ("merchantId", "day") DO UPDATE
         SET "gasUsedWei" = "RelayDailyUsage"."gasUsedWei" + $3::numeric, "updatedAt" = $4::timestamp`,
      merchantId,
      utcDay(now),
      gasWei.toString(),
      now.toISOString(),
    )
  }

  private async alertOnce(
    merchantId: string,
    day: string,
    alert: BudgetAlert,
    submissions: number,
    quota: number,
    now: Date,
  ): Promise<void> {
    const key = { merchantId, day: new Date(`${day}T00:00:00.000Z`) }
    const claimed =
      alert === 'warned'
        ? await this.prisma.db.relayDailyUsage.updateMany({
            where: { ...key, warnedAt: null },
            data: { warnedAt: now },
          })
        : await this.prisma.db.relayDailyUsage.updateMany({
            where: { ...key, exhaustedAt: null },
            data: { exhaustedAt: now },
          })
    if (claimed.count === 0) return

    const summary = `relay.budget merchant=${merchantId} day=${day} submissions=${submissions} quota=${quota}`
    const subject =
      alert === 'warned'
        ? `Relay budget at ${Math.round(RELAY_BUDGET_WARN_RATIO * 100)}% for merchant ${merchantId}`
        : `Relay budget exhausted for merchant ${merchantId}`
    if (alert === 'warned') this.log.warn(`${summary} reached the warning threshold`)
    else this.log.error(`${summary} exhausted`)

    if (!this.alertEmail) return
    void this.email
      .send({
        to: this.alertEmail,
        subject,
        html: `<p>${subject}.</p><p>${submissions} of ${quota} relayed submissions used on ${day} (UTC).</p>`,
        text: `${subject}. ${submissions} of ${quota} relayed submissions used on ${day} (UTC).`,
      })
      .catch((err: unknown) =>
        this.log.error(`${summary} alert email failed: ${(err as Error).message}`),
      )
  }
}
