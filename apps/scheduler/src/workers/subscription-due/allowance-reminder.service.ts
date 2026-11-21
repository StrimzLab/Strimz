import { Injectable, Logger } from '@nestjs/common'
import type { Prisma, Subscription } from '@strimz/db'
import { PayerAllowanceRenewalEmail, renderToHtml } from '@strimz/email-templates'
import { getTokenAddress } from '@strimz/shared-config'
import { formatUnits, type Address } from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { manageSubscriptionUrl } from '../../infra/email/payer-links.js'

// This charge plus two more, for every live subscription sharing the allowance.
const CHARGES_OF_WARNING = 3n

/**
 * ADR-2026-11-13-capped-subscription-allowance: subscribers approve a capped
 * amount, so tell them to renew before it runs out. Never blocks a charge.
 */
@Injectable()
export class AllowanceReminderService {
  private readonly log = new Logger(AllowanceReminderService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly email: EmailService,
    private readonly cfg: TypedConfigService,
  ) {}

  async check(sub: Subscription): Promise<void> {
    const token = getTokenAddress(this.cfg.env.ARC_ENVIRONMENT, sub.currency)
    let allowance: bigint
    try {
      allowance = await this.chain.readSubscriptionAllowance(token, sub.payerAddress as Address)
    } catch (err) {
      this.log.error(`allowance read for sub ${sub.id} failed: ${(err as Error).message}`)
      return
    }

    const live = await this.prisma.db.subscription.findMany({
      where: {
        payerAddress: { equals: sub.payerAddress, mode: 'insensitive' },
        currency: sub.currency,
        status: { in: ['trialing', 'active', 'at_risk'] },
      },
      select: { amount: true },
    })
    const perPeriod = live.reduce((sum, s) => sum + BigInt(s.amount), 0n)
    const meta = { ...((sub.metadata as Record<string, unknown> | null) ?? {}) }

    if (allowance >= perPeriod * CHARGES_OF_WARNING) {
      if (!('allowanceLowAt' in meta) && !('allowanceReminderPeriodEnd' in meta)) return
      delete meta.allowanceLowAt
      delete meta.allowanceReminderPeriodEnd
      await this.save(sub.id, meta)
      return
    }

    meta.allowanceLowAt ??= new Date().toISOString()
    const periodEnd = sub.currentPeriodEndAt.toISOString()
    if (meta.allowanceReminderPeriodEnd !== periodEnd && (await this.sendReminder(sub))) {
      meta.allowanceReminderPeriodEnd = periodEnd
    }
    await this.save(sub.id, meta)
  }

  /** True once the payer has been told, or has no email to tell. */
  private async sendReminder(sub: Subscription): Promise<boolean> {
    const row = await this.prisma.db.subscription.findUniqueOrThrow({
      where: { id: sub.id },
      select: {
        customer: { select: { email: true } },
        plan: { select: { name: true } },
        merchant: { select: { businessName: true } },
      },
    })
    if (!row.customer.email) return true
    try {
      const html = await renderToHtml(
        PayerAllowanceRenewalEmail({
          merchantBusinessName: row.merchant.businessName ?? 'Your merchant',
          planName: row.plan.name,
          amountDisplay: `${formatUnits(BigInt(sub.amount), 6)} ${sub.currency}`,
          renewUrl: `${this.cfg.env.CHECKOUT_ORIGIN.replace(/\/+$/, '')}/sub/renew/${sub.id}`,
          manageUrl: manageSubscriptionUrl(this.cfg.env.CHECKOUT_ORIGIN, sub.id),
        }),
      )
      await this.email.send({
        to: row.customer.email,
        subject: `Renew your approval for ${row.plan.name}`,
        html,
      })
      return true
    } catch (err) {
      this.log.error(`allowance reminder for sub ${sub.id} failed: ${(err as Error).message}`)
      return false
    }
  }

  private async save(id: string, metadata: Record<string, unknown>): Promise<void> {
    await this.prisma.db.subscription.update({
      where: { id },
      data: { metadata: metadata as Prisma.InputJsonObject },
    })
  }
}
