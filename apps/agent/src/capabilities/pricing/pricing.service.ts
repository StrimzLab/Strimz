import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'

/**
 * Monthly pricing-intelligence digest. Aggregates the same SQL the API
 * exposes via `/v1/stats/{mrr,churn,forecast}` and emails the merchant
 * a forward-looking summary at the start of every month.
 *
 * No automation, no on-chain action — purely a periodic report. Lives
 * in the agent process so the API server never gets blocked rendering
 * heavyweight aggregates synchronously.
 */
@Injectable()
export class PricingService {
  private readonly log = new Logger(PricingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async tick(): Promise<{ sent: number }> {
    const merchants = await this.prisma.db.agentMerchantConfig.findMany({
      where: { enabledCapabilities: { has: 'pricing_intelligence' } },
      include: { merchant: true },
    })

    let sent = 0
    for (const cfg of merchants) {
      const [mrr, churn, forecast] = await Promise.all([
        this.computeMrr(cfg.merchantId),
        this.computeChurn(cfg.merchantId),
        this.computeForecast(cfg.merchantId),
      ])

      try {
        await this.email.send({
          to: cfg.merchant.email,
          subject: 'Strimz: monthly pricing intelligence',
          html: renderPricingEmail({
            merchantName: cfg.merchant.businessName ?? 'merchant',
            mrr,
            churnRate: churn,
            forecast,
          }),
        })
      } catch (err) {
        this.log.warn(`pricing email failed for merchant=${cfg.merchantId}: ${(err as Error).message}`)
        continue
      }
      sent++
    }
    return { sent }
  }

  /** Sum of active subscription amounts, normalised to monthly cadence. */
  private async computeMrr(merchantId: string): Promise<bigint> {
    const subs = await this.prisma.db.subscription.findMany({
      where: { merchantId, status: 'active' },
      select: { amount: true, interval: true, intervalCount: true },
    })
    let mrr = 0n
    for (const s of subs) {
      const amount = BigInt(s.amount)
      const factor = BigInt(s.intervalCount || 1)
      switch (s.interval) {
        case 'daily':
          mrr += (amount * 30n) / factor
          break
        case 'weekly':
          mrr += (amount * 30n) / (factor * 7n)
          break
        case 'monthly':
          mrr += amount / factor
          break
        case 'quarterly':
          mrr += amount / (factor * 3n)
          break
        case 'yearly':
          mrr += amount / (factor * 12n)
          break
        default:
          mrr += amount
      }
    }
    return mrr
  }

  /** Trailing-12-month average monthly churn. */
  private async computeChurn(merchantId: string): Promise<number> {
    type Row = { rate: number | null }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT avg(rate)::float8 AS rate FROM (
         SELECT
           date_trunc('month', "createdAt") AS m,
           CASE WHEN count(*) = 0 THEN 0
                ELSE count(*) FILTER (WHERE status IN ('cancelled'::"SubscriptionStatus", 'lapsed'::"SubscriptionStatus"))::float / count(*)::float
           END AS rate
         FROM "Subscription"
         WHERE "merchantId" = $1
           AND "createdAt" >= NOW() - INTERVAL '12 months'
         GROUP BY m
       ) m`,
      merchantId,
    )) as Row[]
    return rows[0]?.rate ?? 0
  }

  /** Linear regression over last 90 days of confirmed transactions. */
  private async computeForecast(
    merchantId: string,
  ): Promise<{ confidence: 'low' | 'medium' | 'high'; next30: bigint; next60: bigint; next90: bigint }> {
    type Row = { rev: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT date_trunc('day', "blockTimestamp") AS day,
              sum(("netAmount")::numeric)::bigint AS rev
         FROM "Transaction"
        WHERE "merchantId" = $1
          AND status = 'confirmed'::"TransactionStatus"
          AND "blockTimestamp" >= NOW() - INTERVAL '90 days'
        GROUP BY day
        ORDER BY day ASC`,
      merchantId,
    )) as Row[]
    if (rows.length < 7) {
      return { confidence: 'low', next30: 0n, next60: 0n, next90: 0n }
    }
    const n = rows.length
    const xs: number[] = rows.map((_r, i) => i)
    const ys: number[] = rows.map((r) => Number(r.rev) / 1_000_000)
    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((acc, x, i) => acc + x * (ys[i] ?? 0), 0)
    const sumXX = xs.reduce((acc, x) => acc + x * x, 0)
    const denom = n * sumXX - sumX * sumX
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
    const intercept = (sumY - slope * sumX) / n
    const last = n - 1
    const project = (days: number): bigint => {
      const v = (slope * (last + days) + intercept) * days
      const micros = Math.max(0, Math.round(v * 1_000_000))
      return BigInt(micros)
    }
    return {
      confidence: n >= 60 ? 'high' : n >= 30 ? 'medium' : 'low',
      next30: project(30),
      next60: project(60),
      next90: project(90),
    }
  }
}

function renderPricingEmail(input: {
  merchantName: string
  mrr: bigint
  churnRate: number
  forecast: { confidence: string; next30: bigint; next60: bigint; next90: bigint }
}): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#02C76A;margin:0 0 16px;">Pricing intelligence</h2>
      <p>${escapeHtml(input.merchantName)} — here's the AutoPay Agent's read on your pricing & growth this period.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">MRR</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${humanise(input.mrr)} USDC</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Churn (12-month avg)</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${(input.churnRate * 100).toFixed(2)}%</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Forecast confidence</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${input.forecast.confidence}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Next 30 days</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${humanise(input.forecast.next30)} USDC</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Next 60 days</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${humanise(input.forecast.next60)} USDC</td></tr>
        <tr><td style="padding:8px;">Next 90 days</td><td style="padding:8px;text-align:right;">${humanise(input.forecast.next90)} USDC</td></tr>
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
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
