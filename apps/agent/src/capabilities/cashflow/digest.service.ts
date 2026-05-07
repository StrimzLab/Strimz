import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { ActivityLogService } from '../../infra/activity-log/activity-log.service.js'

/**
 * Daily cashflow digest. For every merchant with
 * `cashflowDigestEnabled = true`, aggregates yesterday's transactions
 * (00:00 → 23:59 UTC) and emails a summary:
 *
 *   - revenue (sum of confirmed `Transaction.amount`)
 *   - fees   (sum of `Transaction.feeAmount`)
 *   - net    (sum of `Transaction.netAmount`)
 *   - count, unique customers
 *
 * Idempotent per (merchant, calendar-day-UTC) via an
 * `AgentActivityLog` lookup so two ticks on the same day no-op.
 */
@Injectable()
export class CashflowDigestService {
  private readonly log = new Logger(CashflowDigestService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly activity: ActivityLogService,
  ) {}

  /**
   * Process digests for the day immediately preceding `now` (UTC).
   * The default `now` is the wall-clock; tests override it.
   */
  async tick(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
    const dayStart = utcDayFloor(new Date(now.getTime() - 24 * 60 * 60 * 1_000))
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1_000)

    const merchants = await this.prisma.db.agentMerchantConfig.findMany({
      where: {
        enabledCapabilities: { has: 'cashflow' },
        cashflowDigestEnabled: true,
      },
      include: { merchant: true },
    })

    let sent = 0
    let skipped = 0
    for (const cfg of merchants) {
      // Dedup within the same UTC day window.
      const alreadySent = await this.prisma.db.agentActivityLog.findFirst({
        where: {
          merchantId: cfg.merchantId,
          capability: 'cashflow',
          actionType: 'cashflow_digest_sent',
          createdAt: { gte: dayEnd },
        },
        select: { id: true },
      })
      if (alreadySent) {
        skipped++
        continue
      }

      const stats = await this.aggregate(cfg.merchantId, dayStart, dayEnd)
      const html = renderDigestEmail({
        merchantName: cfg.merchant.businessName ?? 'merchant',
        date: dayStart,
        ...stats,
      })

      try {
        await this.email.send({
          to: cfg.merchant.email,
          subject: `Strimz daily digest — ${formatDate(dayStart)}`,
          html,
        })
        await this.activity.record({
          merchantId: cfg.merchantId,
          capability: 'cashflow',
          actionType: 'cashflow_digest_sent',
          outcome: 'success',
          metadata: {
            day: dayStart.toISOString().slice(0, 10),
            revenue: stats.revenue.toString(),
            fees: stats.fees.toString(),
            net: stats.net.toString(),
            count: stats.count,
            uniqueCustomers: stats.uniqueCustomers,
          },
        })
        sent++
      } catch (err) {
        this.log.warn(
          `digest email failed for merchant=${cfg.merchantId}: ${(err as Error).message}`,
        )
        await this.activity.record({
          merchantId: cfg.merchantId,
          capability: 'cashflow',
          actionType: 'cashflow_digest_sent',
          outcome: 'failure',
          metadata: { error: (err as Error).message },
        })
      }
    }

    return { sent, skipped }
  }

  private async aggregate(
    merchantId: string,
    from: Date,
    to: Date,
  ): Promise<{
    revenue: bigint
    fees: bigint
    net: bigint
    count: number
    uniqueCustomers: number
  }> {
    type Row = {
      revenue: bigint | null
      fees: bigint | null
      net: bigint | null
      count: bigint
      uniqueCustomers: bigint
    }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT
         COALESCE(sum(("amount")::numeric), 0)::bigint     AS revenue,
         COALESCE(sum(("feeAmount")::numeric), 0)::bigint  AS fees,
         COALESCE(sum(("netAmount")::numeric), 0)::bigint  AS net,
         count(*)::bigint                                  AS count,
         count(DISTINCT "customerId")::bigint              AS "uniqueCustomers"
       FROM "Transaction"
       WHERE "merchantId" = $1
         AND status = 'confirmed'::"TransactionStatus"
         AND "blockTimestamp" >= $2
         AND "blockTimestamp" < $3`,
      merchantId,
      from,
      to,
    )) as Row[]
    const r = rows[0] ?? {
      revenue: 0n,
      fees: 0n,
      net: 0n,
      count: 0n,
      uniqueCustomers: 0n,
    }
    return {
      revenue: r.revenue ?? 0n,
      fees: r.fees ?? 0n,
      net: r.net ?? 0n,
      count: Number(r.count),
      uniqueCustomers: Number(r.uniqueCustomers),
    }
  }
}

function utcDayFloor(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function renderDigestEmail(input: {
  merchantName: string
  date: Date
  revenue: bigint
  fees: bigint
  net: bigint
  count: number
  uniqueCustomers: number
}): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#02C76A;margin:0 0 16px;">Daily digest — ${formatDate(input.date)}</h2>
      <p>${escapeHtml(input.merchantName)} — yesterday's activity:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Revenue</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${humanise(input.revenue)} USDC</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Fees</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${humanise(input.fees)} USDC</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Net</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${humanise(input.net)} USDC</td></tr>
        <tr><td style="padding:8px;">Transactions</td><td style="padding:8px;text-align:right;">${input.count}</td></tr>
        <tr><td style="padding:8px;">Unique customers</td><td style="padding:8px;text-align:right;">${input.uniqueCustomers}</td></tr>
      </table>
    </div>
  `
}

function humanise(raw: bigint): string {
  const whole = raw / 1_000_000n
  const frac = (raw % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return frac.length === 0 ? whole.toString() : `${whole}.${frac}`
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
