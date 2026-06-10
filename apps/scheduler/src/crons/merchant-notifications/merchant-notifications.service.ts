import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import {
  PaymentReceivedEmail,
  STRIMZ_ORIGIN,
  SubscriptionChargedEmail,
  SubscriptionStartedEmail,
  WelcomeEmail,
  renderToHtml,
} from '@strimz/email-templates'
import { formatUnits } from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'

/**
 * Single cron that owns every merchant-facing transactional email.
 *
 * Four polling lanes, all stamped via a `*NotifiedAt` column on the
 * source row so each send is exactly-once. NULL = un-sent → pick up.
 * Non-NULL = sent → ignore. The partial index on each column keeps the
 * scan cost flat as the table grows.
 *
 *   1. Welcome           — Merchant.welcomeNotifiedAt IS NULL
 *   2. Payment received  — PaymentSession.status=confirmed
 *                          AND merchantNotifiedAt IS NULL
 *   3. Subscription started
 *                        — Subscription.merchantNotifiedAt IS NULL
 *   4. Subscription charged
 *                        — SubscriptionCharge.status=succeeded
 *                          AND merchantNotifiedAt IS NULL
 *
 * Why poll rather than fire from the indexer or auth/sync handler:
 *   - The indexer is Go; it doesn't speak Resend or React Email.
 *   - The auth/sync handler runs in the Privy login critical path; an
 *     SMTP hiccup there would surface as a sign-in failure.
 *   - The signal we care about in each lane is a row state transition —
 *     perfectly observable via SQL. Polling at 30s gives near-instant
 *     inbox delivery without coupling the indexer or the API to
 *     Resend's availability.
 *
 * Each send is best-effort. A failure logs but does not block the
 * cron — the row stays unmarked and the next tick retries. We bound
 * retry pressure by capping the per-tick batch via
 * `MERCHANT_NOTIFICATION_BATCH_SIZE`.
 *
 * Stub-mode behaviour: when `RESEND_API_KEY` is unset, `EmailService`
 * returns `queued: false`. We still stamp `merchantNotifiedAt` so the
 * row stops polling — the alternative (re-trying every tick forever in
 * dev) would mask real Resend failures behind constant churn.
 */
@Injectable()
export class MerchantNotificationsService {
  private readonly log = new Logger(MerchantNotificationsService.name)

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Cron(process.env.MERCHANT_NOTIFICATION_CRON || '*/30 * * * * *', {
    name: 'merchant-notifications',
  })
  async tick(): Promise<TickResult> {
    return this.tickNow()
  }

  async tickNow(): Promise<TickResult> {
    const [welcome, payment, subStarted, subCharged] = await Promise.all([
      this.runWelcomeLane(),
      this.runPaymentLane(),
      this.runSubscriptionStartedLane(),
      this.runSubscriptionChargedLane(),
    ])

    const totals: TickResult = {
      welcome,
      payment,
      subscriptionStarted: subStarted,
      subscriptionCharged: subCharged,
      sent: welcome.sent + payment.sent + subStarted.sent + subCharged.sent,
      failed: welcome.failed + payment.failed + subStarted.failed + subCharged.failed,
    }
    this.log.log(
      `merchant-notifications: welcome=${welcome.sent}/${welcome.failed} ` +
        `payment=${payment.sent}/${payment.failed} ` +
        `subStarted=${subStarted.sent}/${subStarted.failed} ` +
        `subCharged=${subCharged.sent}/${subCharged.failed}`,
    )
    return totals
  }

  // ------------------------------------------------------------------
  // Lane 1: Welcome email — fires once per Merchant row.
  // ------------------------------------------------------------------
  private async runWelcomeLane(): Promise<LaneResult> {
    const rows = await this.prisma.db.merchant.findMany({
      where: { welcomeNotifiedAt: null },
      select: { id: true, email: true, businessName: true },
      orderBy: { createdAt: 'asc' },
      take: this.cfg.env.MERCHANT_NOTIFICATION_BATCH_SIZE,
    })
    if (rows.length === 0) return { sent: 0, failed: 0 }

    let sent = 0
    let failed = 0
    for (const row of rows) {
      try {
        const html = await renderToHtml(
          WelcomeEmail({
            merchantBusinessName: row.businessName,
            dashboardUrl: `${this.dashboardOrigin()}/app`,
            docsUrl: `${STRIMZ_ORIGIN}/docs`,
          }),
        )
        await this.email.send({
          to: row.email,
          subject: 'Welcome to Strimz',
          html,
        })
        await this.prisma.db.merchant.update({
          where: { id: row.id },
          data: { welcomeNotifiedAt: new Date() },
        })
        sent++
      } catch (err) {
        failed++
        this.warn('welcome', row.id, err)
      }
    }
    return { sent, failed }
  }

  // ------------------------------------------------------------------
  // Lane 2: "You got paid" — fires once per confirmed PaymentSession.
  // ------------------------------------------------------------------
  private async runPaymentLane(): Promise<LaneResult> {
    const rows = await this.prisma.db.paymentSession.findMany({
      where: { status: 'confirmed', merchantNotifiedAt: null },
      include: { merchant: { select: { email: true, businessName: true } } },
      orderBy: { updatedAt: 'asc' },
      take: this.cfg.env.MERCHANT_NOTIFICATION_BATCH_SIZE,
    })
    if (rows.length === 0) return { sent: 0, failed: 0 }

    const { network, explorerBase } = this.networkContext()

    let sent = 0
    let failed = 0
    for (const row of rows) {
      try {
        const amountDisplay = `${formatUnits(BigInt(row.amount), 6)} ${row.currency}`
        const payerShort = this.shortAddr(row.payerWalletAddress)
        const explorerTxUrl = row.onchainTxHash ? `${explorerBase}/tx/${row.onchainTxHash}` : '#'

        const html = await renderToHtml(
          PaymentReceivedEmail({
            merchantBusinessName: row.merchant.businessName ?? 'merchant',
            amountDisplay,
            payerAddressShort: payerShort,
            sessionDescription: row.description,
            sessionId: row.id,
            network,
            explorerTxUrl,
            dashboardUrl: `${this.dashboardOrigin()}/app/transactions`,
          }),
        )
        await this.email.send({
          to: row.merchant.email,
          subject: `You received ${amountDisplay}`,
          html,
        })
        await this.prisma.db.paymentSession.update({
          where: { id: row.id },
          data: { merchantNotifiedAt: new Date() },
        })
        sent++
      } catch (err) {
        failed++
        this.warn('payment', row.id, err)
      }
    }
    return { sent, failed }
  }

  // ------------------------------------------------------------------
  // Lane 3: New subscriber — fires once per Subscription row.
  // ------------------------------------------------------------------
  private async runSubscriptionStartedLane(): Promise<LaneResult> {
    const rows = await this.prisma.db.subscription.findMany({
      where: { merchantNotifiedAt: null },
      include: {
        merchant: { select: { email: true, businessName: true } },
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
      try {
        const amountDisplay = `${formatUnits(BigInt(row.amount), 6)} ${row.currency}`
        const cadenceDisplay = this.cadenceDisplay(row.plan.interval, row.plan.intervalCount)
        const payerShort = this.shortAddr(row.payerAddress)
        const explorerTxUrl = row.enrolmentTxHash
          ? `${explorerBase}/tx/${row.enrolmentTxHash}`
          : '#'

        const html = await renderToHtml(
          SubscriptionStartedEmail({
            merchantBusinessName: row.merchant.businessName ?? 'merchant',
            planName: row.plan.name,
            amountDisplay,
            cadenceDisplay,
            payerAddressShort: payerShort,
            subscriptionId: row.id,
            network,
            nextChargeAt: this.formatDate(row.nextChargeAt) ?? 'Pending',
            explorerTxUrl,
            dashboardUrl: `${this.dashboardOrigin()}/app/subscriptions/${row.id}`,
          }),
        )
        await this.email.send({
          to: row.merchant.email,
          subject: `New subscriber on ${row.plan.name}`,
          html,
        })
        await this.prisma.db.subscription.update({
          where: { id: row.id },
          data: { merchantNotifiedAt: new Date() },
        })
        sent++
      } catch (err) {
        failed++
        this.warn('subscription-started', row.id, err)
      }
    }
    return { sent, failed }
  }

  // ------------------------------------------------------------------
  // Lane 4: Recurring charge succeeded — fires once per SubscriptionCharge
  //          whose status flipped to `succeeded`.
  // ------------------------------------------------------------------
  private async runSubscriptionChargedLane(): Promise<LaneResult> {
    const rows = await this.prisma.db.subscriptionCharge.findMany({
      where: { status: 'succeeded', merchantNotifiedAt: null },
      include: {
        merchant: { select: { email: true, businessName: true } },
        subscription: {
          select: {
            payerAddress: true,
            nextChargeAt: true,
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
      try {
        const amountDisplay = `${formatUnits(BigInt(row.amount), 6)} ${row.currency}`
        const payerShort = this.shortAddr(row.subscription.payerAddress)
        const explorerTxUrl = row.onchainTxHash ? `${explorerBase}/tx/${row.onchainTxHash}` : '#'
        const periodLabel = `${this.formatDate(row.periodStartAt) ?? '?'} – ${
          this.formatDate(row.periodEndAt) ?? '?'
        }`

        const html = await renderToHtml(
          SubscriptionChargedEmail({
            merchantBusinessName: row.merchant.businessName ?? 'merchant',
            planName: row.subscription.plan.name,
            amountDisplay,
            payerAddressShort: payerShort,
            subscriptionId: row.subscriptionId,
            chargeId: row.id,
            network,
            periodLabel,
            nextChargeAt: this.formatDate(row.subscription.nextChargeAt),
            explorerTxUrl,
            dashboardUrl: `${this.dashboardOrigin()}/app/subscriptions/${row.subscriptionId}`,
          }),
        )
        await this.email.send({
          to: row.merchant.email,
          subject: `You received ${amountDisplay}`,
          html,
        })
        await this.prisma.db.subscriptionCharge.update({
          where: { id: row.id },
          data: { merchantNotifiedAt: new Date() },
        })
        sent++
      } catch (err) {
        failed++
        this.warn('subscription-charged', row.id, err)
      }
    }
    return { sent, failed }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private dashboardOrigin(): string {
    // STRIMZ_DASHBOARD_URL is env-driven so dev points at localhost:3000
    // and prod points at https://strimz-finance.vercel.app (later
    // https://strimz.finance once the apex is wired). Defaults to the
    // canonical origin so a forgotten env still produces working CTAs.
    return process.env.STRIMZ_DASHBOARD_URL ?? STRIMZ_ORIGIN
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

  private shortAddr(addr: string | null): string {
    if (!addr) return 'unknown'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  private formatDate(d: Date | null | undefined): string | null {
    if (!d) return null
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  private cadenceDisplay(interval: string, count: number): string {
    // "every 1 month" reads awkward — collapse the leading 1.
    const unit = interval.toLowerCase().replace(/s$/, '') // months -> month
    return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`
  }

  private warn(lane: string, id: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err)
    this.log.warn(`${lane} notification failed for ${id}: ${msg} — will retry next tick`)
  }
}

export interface LaneResult {
  sent: number
  failed: number
}

export interface TickResult extends LaneResult {
  welcome: LaneResult
  payment: LaneResult
  subscriptionStarted: LaneResult
  subscriptionCharged: LaneResult
}
