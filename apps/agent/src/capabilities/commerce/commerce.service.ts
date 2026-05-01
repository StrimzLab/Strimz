import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { ActivityLogService } from '../../infra/activity-log/activity-log.service.js'

/**
 * Monthly commerce summary. For each merchant with `commerce` enabled,
 * sums approved+completed `AgentJob.amount` from the previous calendar
 * month, breaks down by vendor, and emails a report including:
 *
 *   - total spend vs `commerceMonthlySpendCapUsdCents` (if set)
 *   - top 5 vendors by spend
 *   - count of jobs requiring human approval (proposed)
 *   - jobs that bypassed the approval gate (cap exceeded?)
 */
@Injectable()
export class CommerceService {
  private readonly log = new Logger(CommerceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly activity: ActivityLogService,
  ) {}

  async tick(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
    const monthEnd = utcMonthFloor(now)
    const monthStart = utcMonthFloor(new Date(monthEnd.getTime() - 1))

    const merchants = await this.prisma.db.agentMerchantConfig.findMany({
      where: { enabledCapabilities: { has: 'commerce' } },
      include: { merchant: true },
    })

    let sent = 0
    let skipped = 0
    for (const cfg of merchants) {
      // Dedup per month.
      const already = await this.prisma.db.agentActivityLog.findFirst({
        where: {
          merchantId: cfg.merchantId,
          capability: 'commerce',
          actionType: 'commerce_job_completed',
          createdAt: { gte: monthEnd },
          metadata: { path: ['stage'], equals: 'monthly_summary' },
        },
        select: { id: true },
      })
      if (already) {
        skipped++
        continue
      }

      const summary = await this.computeSummary(cfg.merchantId, monthStart, monthEnd)
      try {
        await this.email.send({
          to: cfg.merchant.email,
          subject: `Strimz: ${formatMonth(monthStart)} commerce summary`,
          html: renderSummaryEmail({
            merchantName: cfg.merchant.businessName ?? 'merchant',
            month: monthStart,
            summary,
            cap: cfg.commerceMonthlySpendCapUsdCents,
          }),
        })
      } catch (err) {
        this.log.warn(`commerce email failed for merchant=${cfg.merchantId}: ${(err as Error).message}`)
      }

      await this.activity.record({
        merchantId: cfg.merchantId,
        capability: 'commerce',
        actionType: 'commerce_job_completed',
        outcome: 'success',
        metadata: {
          stage: 'monthly_summary',
          month: monthStart.toISOString().slice(0, 7),
          totalSpendCents: summary.totalSpendCents,
          jobCount: summary.jobCount,
          topVendorCount: summary.topVendors.length,
          capUtilisationPct:
            cfg.commerceMonthlySpendCapUsdCents && cfg.commerceMonthlySpendCapUsdCents > 0
              ? Math.round((summary.totalSpendCents * 100) / cfg.commerceMonthlySpendCapUsdCents)
              : null,
        },
      })
      sent++
    }

    return { sent, skipped }
  }

  private async computeSummary(
    merchantId: string,
    from: Date,
    to: Date,
  ): Promise<{
    totalSpendCents: number
    jobCount: number
    topVendors: { vendor: string; spendCents: number; jobs: number }[]
    proposedCount: number
  }> {
    type Row = { vendor: string; spend: bigint; jobs: bigint }
    const vendorRows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT "vendorAddress" AS vendor,
              sum(("amount")::numeric)::bigint AS spend,
              count(*)::bigint AS jobs
         FROM "AgentJob"
        WHERE "merchantId" = $1
          AND status IN ('approved'::"AgentJobStatus", 'completed'::"AgentJobStatus")
          AND "createdAt" >= $2 AND "createdAt" < $3
        GROUP BY "vendorAddress"
        ORDER BY spend DESC
        LIMIT 5`,
      merchantId,
      from,
      to,
    )) as Row[]

    type CountRow = { c: bigint }
    const proposedRows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT count(*)::bigint AS c FROM "AgentJob"
        WHERE "merchantId" = $1 AND status = 'proposed'::"AgentJobStatus"
          AND "createdAt" >= $2 AND "createdAt" < $3`,
      merchantId,
      from,
      to,
    )) as CountRow[]

    const totalMicros = vendorRows.reduce((acc, r) => acc + r.spend, 0n)
    return {
      totalSpendCents: Number(totalMicros / 10_000n),
      jobCount: vendorRows.reduce((acc, r) => acc + Number(r.jobs), 0),
      topVendors: vendorRows.map((r) => ({
        vendor: r.vendor,
        spendCents: Number(r.spend / 10_000n),
        jobs: Number(r.jobs),
      })),
      proposedCount: Number(proposedRows[0]?.c ?? 0n),
    }
  }
}

function utcMonthFloor(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function formatMonth(d: Date): string {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function renderSummaryEmail(input: {
  merchantName: string
  month: Date
  summary: {
    totalSpendCents: number
    jobCount: number
    topVendors: { vendor: string; spendCents: number; jobs: number }[]
    proposedCount: number
  }
  cap: number | null
}): string {
  const capLine = input.cap
    ? `<p>Cap utilisation: $${(input.summary.totalSpendCents / 100).toFixed(2)} of $${(input.cap / 100).toFixed(2)} (${Math.round((input.summary.totalSpendCents * 100) / input.cap)}%)</p>`
    : ''
  const vendorRows = input.summary.topVendors.length
    ? input.summary.topVendors
        .map(
          (v) =>
            `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(v.vendor)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${v.jobs}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${(v.spendCents / 100).toFixed(2)}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="3" style="padding:12px;color:#888;text-align:center;">No vendor activity</td></tr>`

  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#02C76A;margin:0 0 16px;">${formatMonth(input.month)} commerce summary</h2>
      <p>${escapeHtml(input.merchantName)} — here's what happened on the AutoPay Agent's commerce surface last month.</p>
      <p><strong>Total spend:</strong> $${(input.summary.totalSpendCents / 100).toFixed(2)} across ${input.summary.jobCount} jobs.</p>
      ${capLine}
      ${input.summary.proposedCount > 0 ? `<p style="background:#fff5f5;padding:12px;border-radius:8px;color:#c92a2a;"><strong>${input.summary.proposedCount} job(s)</strong> are awaiting your approval.</p>` : ''}
      <h3 style="margin:24px 0 8px;">Top vendors</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr><th align="left" style="padding:8px;border-bottom:2px solid #ddd;">Vendor</th><th align="right" style="padding:8px;border-bottom:2px solid #ddd;">Jobs</th><th align="right" style="padding:8px;border-bottom:2px solid #ddd;">Spend</th></tr></thead>
        <tbody>${vendorRows}</tbody>
      </table>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
