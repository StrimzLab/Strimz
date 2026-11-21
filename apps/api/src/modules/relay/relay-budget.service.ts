import { Injectable, Logger } from '@nestjs/common'
import type { MerchantTier } from '@strimz/db'

import { TypedConfigService } from '../../config/index.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

export const RELAY_DAILY_QUOTA: Readonly<Record<MerchantTier, number>> = {
  free: 500,
  starter: 5_000,
  growth: 50_000,
  enterprise: 50_000,
}

export const RELAY_BUDGET_WARN_RATIO = 0.8

/** A free merchant's quota until its first real payment (ADR-2026-11-21-relay-gas-protection). */
export const STARTER_RELAY_QUOTA = 50

const UNLOCK_MIN_AMOUNT = '1000000'

type BudgetAlert = 'warned' | 'exhausted'

interface UsageRow {
  submissions: number
  warnedAt: Date | null
  exhaustedAt: Date | null
}

function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
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

  /** Takes one unit of today's quota; false when it's spent. */
  async consume(merchantId: string, now = new Date()): Promise<boolean> {
    const merchant = await this.prisma.db.merchant.findUniqueOrThrow({
      where: { id: merchantId },
      select: { tier: true, relayUnlockedAt: true },
    })
    const starter =
      merchant.tier === 'free' &&
      merchant.relayUnlockedAt === null &&
      !(await this.unlockByPayment(merchantId, now))
    const quota = starter ? STARTER_RELAY_QUOTA : RELAY_DAILY_QUOTA[merchant.tier]
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
    if (!row) return false

    if (row.submissions >= quota && row.exhaustedAt === null) {
      await this.alertOnce(merchantId, day, 'exhausted', row.submissions, quota, now)
    } else if (
      row.submissions >= Math.ceil(quota * RELAY_BUDGET_WARN_RATIO) &&
      row.warnedAt === null
    ) {
      await this.alertOnce(merchantId, day, 'warned', row.submissions, quota, now)
    }
    return true
  }

  /** Gives back a unit taken today, for a relay that reverted. */
  async release(merchantId: string, now = new Date()): Promise<void> {
    await this.prisma.db.$executeRawUnsafe(
      `UPDATE "RelayDailyUsage" SET "submissions" = "submissions" - 1, "updatedAt" = $3::timestamp
        WHERE "merchantId" = $1 AND "day" = $2::date AND "submissions" > 0`,
      merchantId,
      utcDay(now),
      now.toISOString(),
    )
  }

  private async unlockByPayment(merchantId: string, now: Date): Promise<boolean> {
    const [paid] = await this.prisma.db.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM "Transaction"
        WHERE "merchantId" = $1
          AND "status" = 'confirmed'
          AND "kind" IN ('one_shot', 'subscription_charge', 'invoice_payment', 'storefront_purchase')
          AND "amount"::numeric >= $2::numeric
        LIMIT 1`,
      merchantId,
      UNLOCK_MIN_AMOUNT,
    )
    if (!paid) return false
    await this.prisma.db.merchant.updateMany({
      where: { id: merchantId, relayUnlockedAt: null },
      data: { relayUnlockedAt: now },
    })
    return true
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
