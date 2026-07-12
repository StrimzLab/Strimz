import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  PayerPaymentReceiptEmail,
  PayerRefundReceiptEmail,
  PayerSubscriptionChargedEmail,
  PayerSubscriptionStartedEmail,
  renderToHtml,
} from '@strimz/email-templates'
import { formatUnits } from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { EmailBudgetService } from '../../infra/email/email-budget.service.js'

@Injectable()
export class PayerNotificationsService {
  private readonly log = new Logger(PayerNotificationsService.name)

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly budget: EmailBudgetService,
  ) {}

  @Cron(process.env.MERCHANT_NOTIFICATION_CRON || '*/30 * * * * *', {
    name: 'payer-notifications',
  })
  async tick(): Promise<TickResult> {
    return this.tickNow()
  }

  async tickNow(): Promise<TickResult> {
    const [payment, subStarted, subCharged, refund] = await Promise.all([
      this.runPaymentLane(),
      this.runSubscriptionStartedLane(),
      this.runSubscriptionChargedLane(),
      this.runRefundLane(),
    ])
    const totals: TickResult = {
      payment,
      subscriptionStarted: subStarted,
      subscriptionCharged: subCharged,
      refund,
      sent: payment.sent + subStarted.sent + subCharged.sent + refund.sent,
      failed: payment.failed + subStarted.failed + subCharged.failed + refund.failed,
    }
    this.log.log(
      `payer-notifications: payment=${payment.sent}/${payment.failed} ` +
        `subStarted=${subStarted.sent}/${subStarted.failed} ` +
        `subCharged=${subCharged.sent}/${subCharged.failed} ` +
        `refund=${refund.sent}/${refund.failed}`,
    )
    return totals
  }

  private async runPaymentLane(): Promise<LaneResult> {
    const rows = await this.prisma.db.paymentSession.findMany({
      where: {
        status: 'confirmed',
        customerNotifiedAt: null,
        customerId: { not: null },
      },
      include: {
        merchant: { select: { businessName: true } },
        customer: { select: { email: true } },
      },
      orderBy: { updatedAt: 'asc' },
      take: this.cfg.env.MERCHANT_NOTIFICATION_BATCH_SIZE,
    })
    if (rows.length === 0) return { sent: 0, failed: 0 }

    const { network, explorerBase } = this.networkContext()
    let sent = 0
    let failed = 0
    for (const row of rows) {
      const email = row.customer?.email
      if (!email) {
        await this.markPaymentSent(row.id)
        continue
      }
      const { allowed } = await this.budget.reserve(true)
      if (!allowed) break
      try {
        const merchantName = row.merchant.businessName ?? 'the merchant'
        const amountDisplay = `${formatUnits(BigInt(row.amount), 6)} ${row.currency}`
        const explorerTxUrl = row.onchainTxHash ? `${explorerBase}/tx/${row.onchainTxHash}` : '#'
        const html = await renderToHtml(
          PayerPaymentReceiptEmail({
            merchantBusinessName: merchantName,
            amountDisplay,
            sessionDescription: row.description,
            sessionId: row.id,
            paidAtDisplay: this.formatDateTime(row.updatedAt),
            network,
            explorerTxUrl,
          }),
        )
        await this.email.send({
          to: email,
          subject: `Your ${amountDisplay} payment to ${merchantName}`,
          html,
        })
        await this.markPaymentSent(row.id)
        sent++
      } catch (err) {
        failed++
        this.warn('payment', row.id, err)
      }
    }
    return { sent, failed }
  }

  private async runSubscriptionStartedLane(): Promise<LaneResult> {
    const rows = await this.prisma.db.subscription.findMany({
      where: { customerNotifiedAt: null },
      include: {
        merchant: { select: { businessName: true } },
        customer: { select: { email: true } },
        plan: { select: { name: true, interval: true, intervalCount: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: this.cfg.env.MERCHANT_NOTIFICATION_BATCH_SIZE,
    })
    if (rows.length === 0) return { sent: 0, failed: 0 }

    const { network, explorerBase } = this.networkContext()
    let sent = 0
    let failed = 0
    for (const row of rows) {
      const email = row.customer?.email
      if (!email) {
        await this.markSubscriptionSent(row.id)
        continue
      }
      const { allowed } = await this.budget.reserve(true)
      if (!allowed) break
      try {
        const merchantName = row.merchant.businessName ?? 'the merchant'
        const amountDisplay = `${formatUnits(BigInt(row.amount), 6)} ${row.currency}`
        const intervalDisplay = this.cadenceDisplay(row.plan.interval, row.plan.intervalCount)
        const explorerTxUrl = row.enrolmentTxHash
          ? `${explorerBase}/tx/${row.enrolmentTxHash}`
          : '#'
        const html = await renderToHtml(
          PayerSubscriptionStartedEmail({
            merchantBusinessName: merchantName,
            planName: row.plan.name,
            amountDisplay,
            intervalDisplay,
            // The enrolment charge is due at startAt, so right after
            // creation nextChargeAt still equals startAt. The charge the
            // subscriber sees next lands one interval later; show that
            // instead of repeating the start date.
            nextChargeDisplay:
              this.formatDate(
                this.addInterval(
                  row.currentPeriodStartAt,
                  row.plan.interval,
                  row.plan.intervalCount,
                ),
              ) ?? 'Pending',
            subscriptionId: row.id,
            startedAtDisplay: this.formatDate(row.createdAt) ?? '',
            network,
            explorerTxUrl,
          }),
        )
        await this.email.send({
          to: email,
          subject: `You subscribed to ${merchantName}`,
          html,
        })
        await this.markSubscriptionSent(row.id)
        sent++
      } catch (err) {
        failed++
        this.warn('subscription-started', row.id, err)
      }
    }
    return { sent, failed }
  }

  private async runSubscriptionChargedLane(): Promise<LaneResult> {
    if (!this.cfg.env.SEND_PAYER_CHARGE_RECEIPTS) return { sent: 0, failed: 0 }

    const rows = await this.prisma.db.subscriptionCharge.findMany({
      where: { status: 'succeeded', customerNotifiedAt: null },
      include: {
        merchant: { select: { businessName: true } },
        subscription: {
          select: {
            nextChargeAt: true,
            customer: { select: { email: true } },
            plan: { select: { name: true } },
          },
        },
      },
      orderBy: { executedAt: 'asc' },
      take: this.cfg.env.MERCHANT_NOTIFICATION_BATCH_SIZE,
    })
    if (rows.length === 0) return { sent: 0, failed: 0 }

    const { network, explorerBase } = this.networkContext()
    let sent = 0
    let failed = 0
    for (const row of rows) {
      const email = row.subscription.customer?.email
      if (!email) {
        await this.markChargeSent(row.id)
        continue
      }
      const { allowed } = await this.budget.reserve(false)
      if (!allowed) break
      try {
        const merchantName = row.merchant.businessName ?? 'the merchant'
        const amountDisplay = `${formatUnits(BigInt(row.amount), 6)} ${row.currency}`
        const explorerTxUrl = row.onchainTxHash ? `${explorerBase}/tx/${row.onchainTxHash}` : '#'
        const html = await renderToHtml(
          PayerSubscriptionChargedEmail({
            merchantBusinessName: merchantName,
            planName: row.subscription.plan.name,
            amountDisplay,
            chargedAtDisplay: this.formatDateTime(row.executedAt ?? row.scheduledAt),
            nextChargeDisplay: this.formatDate(row.subscription.nextChargeAt),
            subscriptionId: row.subscriptionId,
            network,
            explorerTxUrl,
          }),
        )
        await this.email.send({
          to: email,
          subject: `${merchantName} charged ${amountDisplay}`,
          html,
        })
        await this.markChargeSent(row.id)
        sent++
      } catch (err) {
        failed++
        this.warn('subscription-charged', row.id, err)
      }
    }
    return { sent, failed }
  }

  private async runRefundLane(): Promise<LaneResult> {
    const rows = await this.prisma.db.refund.findMany({
      where: { status: 'completed', customerNotifiedAt: null },
      include: {
        merchant: { select: { businessName: true } },
        transaction: {
          select: {
            amount: true,
            currency: true,
            createdAt: true,
            session: { select: { customer: { select: { email: true } } } },
          },
        },
      },
      orderBy: { completedAt: 'asc' },
      take: this.cfg.env.MERCHANT_NOTIFICATION_BATCH_SIZE,
    })
    if (rows.length === 0) return { sent: 0, failed: 0 }

    const { network, explorerBase } = this.networkContext()
    let sent = 0
    let failed = 0
    for (const row of rows) {
      const email = row.transaction?.session?.customer?.email
      if (!email) {
        await this.markRefundSent(row.id)
        continue
      }
      const { allowed } = await this.budget.reserve(true)
      if (!allowed) break
      try {
        const merchantName = row.merchant.businessName ?? 'the merchant'
        const refundAmountDisplay = `${formatUnits(BigInt(row.amount), 6)} ${row.currency}`
        const originalAmountDisplay = row.transaction
          ? `${formatUnits(BigInt(row.transaction.amount), 6)} ${row.transaction.currency}`
          : refundAmountDisplay
        const originalPaidAt = row.transaction?.createdAt ?? row.createdAt
        const explorerTxUrl = row.refundTxHash ? `${explorerBase}/tx/${row.refundTxHash}` : '#'
        const html = await renderToHtml(
          PayerRefundReceiptEmail({
            merchantBusinessName: merchantName,
            refundAmountDisplay,
            originalAmountDisplay,
            originalPaidAtDisplay: this.formatDate(originalPaidAt) ?? '',
            refundedAtDisplay: this.formatDateTime(row.completedAt ?? row.createdAt),
            reason: row.note ?? null,
            refundId: row.id,
            sessionId: row.transactionId,
            network,
            explorerTxUrl,
          }),
        )
        await this.email.send({
          to: email,
          subject: `${merchantName} refunded ${refundAmountDisplay}`,
          html,
        })
        await this.markRefundSent(row.id)
        sent++
      } catch (err) {
        failed++
        this.warn('refund', row.id, err)
      }
    }
    return { sent, failed }
  }

  private markPaymentSent(id: string) {
    return this.prisma.db.paymentSession.update({
      where: { id },
      data: { customerNotifiedAt: new Date() },
    })
  }
  private markSubscriptionSent(id: string) {
    return this.prisma.db.subscription.update({
      where: { id },
      data: { customerNotifiedAt: new Date() },
    })
  }
  private markChargeSent(id: string) {
    return this.prisma.db.subscriptionCharge.update({
      where: { id },
      data: { customerNotifiedAt: new Date() },
    })
  }
  private markRefundSent(id: string) {
    return this.prisma.db.refund.update({
      where: { id },
      data: { customerNotifiedAt: new Date() },
    })
  }

  private networkContext(): { network: 'Arc Testnet' | 'Arc Mainnet'; explorerBase: string } {
    const network: 'Arc Testnet' | 'Arc Mainnet' =
      this.cfg.env.ARC_ENVIRONMENT === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'
    const explorerBase =
      this.cfg.env.ARC_ENVIRONMENT === 'mainnet'
        ? 'https://arcscan.app'
        : 'https://testnet.arcscan.app'
    return { network, explorerBase }
  }

  private formatDate(d: Date | null | undefined): string | null {
    if (!d) return null
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  private formatDateTime(d: Date): string {
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    })
  }

  private cadenceDisplay(interval: string, count: number): string {
    const unit = interval.toLowerCase().replace(/s$/, '')
    return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`
  }

  private addInterval(base: Date, interval: string, count: number): Date {
    const d = new Date(base.getTime())
    const n = Math.max(1, count)
    switch (interval) {
      case 'daily':
        d.setUTCDate(d.getUTCDate() + n)
        break
      case 'weekly':
        d.setUTCDate(d.getUTCDate() + 7 * n)
        break
      case 'monthly':
        d.setUTCMonth(d.getUTCMonth() + n)
        break
      case 'quarterly':
        d.setUTCMonth(d.getUTCMonth() + 3 * n)
        break
      case 'yearly':
        d.setUTCFullYear(d.getUTCFullYear() + n)
        break
      default:
        d.setUTCMonth(d.getUTCMonth() + n)
    }
    return d
  }

  private warn(lane: string, id: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err)
    this.log.warn(`${lane} payer notification failed for ${id}: ${msg}`)
  }
}

export interface LaneResult {
  sent: number
  failed: number
}
export interface TickResult extends LaneResult {
  payment: LaneResult
  subscriptionStarted: LaneResult
  subscriptionCharged: LaneResult
  refund: LaneResult
}
