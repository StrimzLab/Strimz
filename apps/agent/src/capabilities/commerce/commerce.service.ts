import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { ActivityLogService } from '../../infra/activity-log/activity-log.service.js'
import { escapeHtml } from '../../common/escape-html.js'
import {
  paymentCurrencySchema,
  type CurrencyAmounts,
  type PaymentCurrency,
} from '@strimz/shared-types'
import {
  currenciesToShow,
  formatAmount,
  toCurrencyAmounts,
} from '../../common/money/currency-amounts.js'

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
        this.log.warn(
          `commerce email failed for merchant=${cfg.merchantId}: ${(err as Error).message}`,
        )
      }

      await this.activity.record({
        merchantId: cfg.merchantId,
        capability: 'commerce',
        actionType: 'commerce_job_completed',
        outcome: 'success',
        metadata: {
          stage: 'monthly_summary',
          month: monthStart.toISOString().slice(0, 7),
          spendUsdc: summary.spend.USDC,
          spendEurc: summary.spend.EURC,
          jobCount: summary.jobCount,
          topVendorCount: summary.topVendors.length,
          capUtilisationPct: capUtilisationPct(summary.spend, cfg.commerceMonthlySpendCapUsdCents),
        },
      })
      sent++
    }

    return { sent, skipped }
  }

  private async computeSummary(merchantId: string, from: Date, to: Date): Promise<CommerceSummary> {
    type VendorRow = { vendor: string; currency: string; spend: string; jobs: bigint }
    const vendorRows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT vendor, currency, spend, jobs FROM (
         SELECT "vendorAddress" AS vendor,
                currency::text AS currency,
                sum(("amount")::numeric)::text AS spend,
                count(*)::bigint AS jobs,
                row_number() OVER (
                  PARTITION BY currency
                  ORDER BY sum(("amount")::numeric) DESC, "vendorAddress"
                ) AS rank
           FROM "AgentJob"
          WHERE "merchantId" = $1
            AND status IN ('approved'::"AgentJobStatus", 'completed'::"AgentJobStatus")
            AND "createdAt" >= $2 AND "createdAt" < $3
          GROUP BY "vendorAddress", currency
       ) ranked
       WHERE rank <= 5
       ORDER BY currency, rank`,
      merchantId,
      from,
      to,
    )) as VendorRow[]

    type TotalRow = { currency: string; spend: string; jobs: bigint }
    const totalRows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT currency::text AS currency,
              sum(("amount")::numeric)::text AS spend,
              count(*)::bigint AS jobs
         FROM "AgentJob"
        WHERE "merchantId" = $1
          AND status IN ('approved'::"AgentJobStatus", 'completed'::"AgentJobStatus")
          AND "createdAt" >= $2 AND "createdAt" < $3
        GROUP BY currency`,
      merchantId,
      from,
      to,
    )) as TotalRow[]

    type CountRow = { c: bigint }
    const proposedRows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT count(*)::bigint AS c FROM "AgentJob"
        WHERE "merchantId" = $1 AND status = 'proposed'::"AgentJobStatus"
          AND "createdAt" >= $2 AND "createdAt" < $3`,
      merchantId,
      from,
      to,
    )) as CountRow[]

    return {
      spend: toCurrencyAmounts(totalRows.map((r) => ({ currency: r.currency, amount: r.spend }))),
      active: new Set(totalRows.map((r) => r.currency as PaymentCurrency)),
      jobCount: totalRows.reduce((acc, r) => acc + Number(r.jobs), 0),
      topVendors: vendorRows.map((r) => ({
        vendor: r.vendor,
        currency: paymentCurrencySchema.parse(r.currency),
        spend: r.spend,
        jobs: Number(r.jobs),
      })),
      proposedCount: Number(proposedRows[0]?.c ?? 0n),
    }
  }
}

interface CommerceSummary {
  spend: CurrencyAmounts
  active: Set<PaymentCurrency>
  jobCount: number
  topVendors: { vendor: string; currency: PaymentCurrency; spend: string; jobs: number }[]
  proposedCount: number
}

function usdcSpendCents(spend: CurrencyAmounts): number {
  return Number(BigInt(spend.USDC) / 10_000n)
}

function capUtilisationPct(spend: CurrencyAmounts, capCents: number | null): number | null {
  return capCents && capCents > 0 ? Math.round((usdcSpendCents(spend) * 100) / capCents) : null
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
  summary: CommerceSummary
  cap: number | null
}): string {
  const spendText = currenciesToShow(input.summary.active)
    .map((c) => formatAmount(input.summary.spend[c], c))
    .join(', ')
  const capPct = capUtilisationPct(input.summary.spend, input.cap)
  const capLine =
    input.cap && capPct !== null
      ? `<p>Cap utilisation (USDC only): ${formatAmount(input.summary.spend.USDC, 'USDC')} of $${(input.cap / 100).toFixed(2)} (${capPct}%)</p>`
      : ''
  const vendorRows = input.summary.topVendors.length
    ? input.summary.topVendors
        .map(
          (v) =>
            `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(v.vendor)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${v.jobs}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatAmount(v.spend, v.currency)}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="3" style="padding:12px;color:#888;text-align:center;">No vendor activity</td></tr>`

  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#02C76A;margin:0 0 16px;">${formatMonth(input.month)} commerce summary</h2>
      <p>${escapeHtml(input.merchantName)} — here's what happened on the AutoPay Agent's commerce surface last month.</p>
      <p><strong>Total spend:</strong> ${spendText} across ${input.summary.jobCount} jobs.</p>
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
