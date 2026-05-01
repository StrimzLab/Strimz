import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { ActivityLogService } from '../../infra/activity-log/activity-log.service.js'

/**
 * Maps the merchant's configured strategy to a per-attempt schedule
 * (offsets in milliseconds since the period-end timestamp).
 *
 *   once             → 1 notification, immediately on at_risk detection
 *   twice            → 2 notifications: T+0, T+24h
 *   until_grace_ends → 3 notifications: T+0, T+24h, T+72h
 *
 * The schedule is deduplicated against `AgentActivityLog` so re-running
 * the cron during the same window is a no-op.
 */
const STRATEGY_SCHEDULE: Record<string, number[]> = {
  once: [0],
  twice: [0, 24 * 60 * 60 * 1_000],
  until_grace_ends: [0, 24 * 60 * 60 * 1_000, 72 * 60 * 60 * 1_000],
}

/**
 * Recovery capability. Hourly tick:
 *
 *   1. For each merchant with `recovery` in `enabledCapabilities`:
 *   2. Find subscriptions in `at_risk` whose `currentPeriodEndAt`
 *      stepped past one of the strategy offsets.
 *   3. Look at `AgentActivityLog` to skip notifications already sent
 *      for this subscription within the dedup window.
 *   4. Send the notification email (using the merchant's
 *      `recoveryNotificationTemplate` if set, else a default).
 *   5. Record an `AgentActivityLog` entry per send.
 *
 * All sends are merchant-scoped: the recipient is the *customer* the
 * subscription belongs to (via `Customer.email`), not the merchant
 * themselves.
 */
@Injectable()
export class RecoveryService {
  private readonly log = new Logger(RecoveryService.name)
  private readonly DEDUP_WINDOW_MS = 23 * 60 * 60 * 1_000 // a hair under 24h

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly activity: ActivityLogService,
  ) {}

  async tick(): Promise<{ notified: number; skipped: number }> {
    const merchants = await this.prisma.db.agentMerchantConfig.findMany({
      where: { enabledCapabilities: { has: 'recovery' } },
      include: { merchant: true },
    })

    let notified = 0
    let skipped = 0
    for (const cfg of merchants) {
      const schedule = STRATEGY_SCHEDULE[cfg.recoveryStrategy] ?? STRATEGY_SCHEDULE.twice!
      const subs = await this.prisma.db.subscription.findMany({
        where: { merchantId: cfg.merchantId, status: 'at_risk' },
        include: { customer: true },
      })

      for (const sub of subs) {
        const elapsed = Date.now() - sub.currentPeriodEndAt.getTime()
        // Find the latest schedule offset we've crossed but not yet acted on.
        // (Manual reverse-find — `Array.findLastIndex` requires lib=es2023.)
        let dueIndex = -1
        for (let i = schedule.length - 1; i >= 0; i--) {
          if (elapsed >= (schedule[i] as number)) {
            dueIndex = i
            break
          }
        }
        if (dueIndex === -1) {
          continue // grace not yet started
        }

        // Have we already sent a notification within the dedup window for
        // this subscription? If so, skip — we'll catch the next offset
        // on the next tick after the previous notification ages out.
        const recentlyNotified = await this.activity.hasRecentForSubscription({
          subscriptionId: sub.id,
          actionType: 'recovery_notification_sent',
          sinceMs: this.DEDUP_WINDOW_MS,
        })
        if (recentlyNotified) {
          skipped++
          continue
        }

        const customerEmail = sub.customer?.email
        if (!customerEmail) {
          // No way to reach the customer; record an abandoned action so
          // the merchant sees it on the dashboard.
          await this.activity.record({
            merchantId: cfg.merchantId,
            capability: 'recovery',
            actionType: 'recovery_abandoned',
            outcome: 'skipped',
            subscriptionId: sub.id,
            metadata: { reason: 'customer email not on file' },
          })
          skipped++
          continue
        }

        const html = renderRecoveryEmail({
          merchantName: cfg.merchant.businessName ?? 'your provider',
          template: cfg.recoveryNotificationTemplate,
          subscriptionId: sub.id,
          attemptNumber: dueIndex + 1,
          totalAttempts: schedule.length,
        })

        try {
          await this.email.send({
            to: customerEmail,
            subject: `Action needed: your subscription with ${cfg.merchant.businessName ?? 'your provider'}`,
            html,
          })
          await this.activity.record({
            merchantId: cfg.merchantId,
            capability: 'recovery',
            actionType: 'recovery_notification_sent',
            outcome: 'success',
            subscriptionId: sub.id,
            metadata: {
              attemptNumber: dueIndex + 1,
              totalAttempts: schedule.length,
              strategy: cfg.recoveryStrategy,
            },
          })
          notified++
        } catch (err) {
          this.log.warn(
            `failed to send recovery email for sub=${sub.id}: ${(err as Error).message}`,
          )
          await this.activity.record({
            merchantId: cfg.merchantId,
            capability: 'recovery',
            actionType: 'recovery_notification_sent',
            outcome: 'failure',
            subscriptionId: sub.id,
            metadata: { error: (err as Error).message },
          })
        }
      }
    }

    return { notified, skipped }
  }
}

function renderRecoveryEmail(input: {
  merchantName: string
  template: string | null
  subscriptionId: string
  attemptNumber: number
  totalAttempts: number
}): string {
  const safeName = escapeHtml(input.merchantName)
  const customMsg = input.template
    ? `<p>${escapeHtml(input.template)}</p>`
    : `<p>Your most recent subscription charge with ${safeName} could not be collected. To avoid an interruption, please make sure your wallet has sufficient funds and your USDC allowance is in place.</p>`
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#02C76A;margin:0 0 16px;">Subscription needs attention</h2>
      ${customMsg}
      <p style="color:#666;">This is notice ${input.attemptNumber} of ${input.totalAttempts}.</p>
      <p style="color:#888;font-size:12px;">Reference: ${escapeHtml(input.subscriptionId)}</p>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
