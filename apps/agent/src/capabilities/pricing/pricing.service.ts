import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { escapeHtml } from '../../common/escape-html.js'
import { forecastDailyRevenue, utcDayKey, type RevenueForecast } from './forecast.js'
import {
  paymentCurrencies,
  paymentCurrencySchema,
  type PaymentCurrency,
} from '@strimz/shared-types'
import { currenciesToShow, formatAmount } from '../../common/money/currency-amounts.js'

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

  async tick(now: Date = new Date()): Promise<{ sent: number }> {
    const merchants = await this.prisma.db.agentMerchantConfig.findMany({
      where: { enabledCapabilities: { has: 'pricing_intelligence' } },
      include: { merchant: true },
    })

    let sent = 0
    for (const cfg of merchants) {
      const [mrr, churn, forecast] = await Promise.all([
        this.computeMrr(cfg.merchantId),
        this.computeChurn(cfg.merchantId),
        this.computeForecast(cfg.merchantId, now),
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
        this.log.warn(
          `pricing email failed for merchant=${cfg.merchantId}: ${(err as Error).message}`,
        )
        continue
      }
      sent++
    }
    return { sent }
  }

  /** Sum of active subscription amounts, normalised to monthly cadence. */
  private async computeMrr(merchantId: string): Promise<PerCurrency<bigint>> {
    const subs = await this.prisma.db.subscription.findMany({
      where: { merchantId, status: 'active', mode: 'live' },
      select: { amount: true, currency: true, interval: true, intervalCount: true },
    })
    const mrr: Record<PaymentCurrency, bigint> = { USDC: 0n, EURC: 0n }
    const active = new Set<PaymentCurrency>()
    for (const s of subs) {
      const currency = paymentCurrencySchema.parse(s.currency)
      mrr[currency] += normaliseToMonthly(BigInt(s.amount), s.interval, s.intervalCount)
      active.add(currency)
    }
    return { values: mrr, active }
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
           AND mode = 'live'::"Mode"
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
    now: Date,
  ): Promise<PerCurrency<RevenueForecast>> {
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const from = new Date(to.getTime() - 90 * 86_400_000)
    type Row = { day: string; currency: string; rev: string }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT to_char(date_trunc('day', "blockTimestamp"), 'YYYY-MM-DD') AS day,
              currency::text AS currency,
              sum(("netAmount")::numeric)::text AS rev
         FROM "Transaction"
        WHERE "merchantId" = $1
          AND status = 'confirmed'::"TransactionStatus"
          AND mode = 'live'::"Mode"
          AND kind <> 'refund'::"TransactionKind"
          AND "blockTimestamp" >= $2
          AND "blockTimestamp" < $3
        GROUP BY day, currency`,
      merchantId,
      from,
      to,
    )) as Row[]
    const lastDay = utcDayKey(new Date(to.getTime() - 86_400_000))
    const active = new Set<PaymentCurrency>()
    const daily: Record<PaymentCurrency, Map<string, bigint>> = { USDC: new Map(), EURC: new Map() }
    for (const r of rows) {
      const currency = paymentCurrencySchema.parse(r.currency)
      daily[currency].set(r.day, BigInt(r.rev))
      active.add(currency)
    }
    const values = {} as Record<PaymentCurrency, RevenueForecast>
    for (const currency of paymentCurrencies) {
      values[currency] = forecastDailyRevenue(daily[currency], lastDay)
    }
    return { values, active }
  }
}

interface PerCurrency<T> {
  values: Record<PaymentCurrency, T>
  active: Set<PaymentCurrency>
}

function normaliseToMonthly(amount: bigint, interval: string, intervalCount: number): bigint {
  const factor = BigInt(intervalCount || 1)
  switch (interval) {
    case 'daily':
      return (amount * 30n) / factor
    case 'weekly':
      return (amount * 30n) / (factor * 7n)
    case 'monthly':
      return amount / factor
    case 'quarterly':
      return amount / (factor * 3n)
    case 'yearly':
      return amount / (factor * 12n)
    default:
      return amount
  }
}

function renderPricingEmail(input: {
  merchantName: string
  mrr: PerCurrency<bigint>
  churnRate: number
  forecast: PerCurrency<RevenueForecast>
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${label}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${value}</td></tr>`
  const shown = currenciesToShow(new Set([...input.mrr.active, ...input.forecast.active]))
  const currencyRows = shown
    .map((c) => {
      const f = input.forecast.values[c]
      return [
        row(`MRR (${c})`, formatAmount(input.mrr.values[c], c)),
        row(`Forecast confidence (${c})`, f.confidence),
        row(`Next 30 days (${c})`, formatAmount(f.next30, c)),
        row(`Next 60 days (${c})`, formatAmount(f.next60, c)),
        row(`Next 90 days (${c})`, formatAmount(f.next90, c)),
      ].join('')
    })
    .join('')
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#02C76A;margin:0 0 16px;">Pricing intelligence</h2>
      <p>${escapeHtml(input.merchantName)} — here's the AutoPay Agent's read on your pricing & growth this period.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        ${row('Churn (12-month avg)', `${(input.churnRate * 100).toFixed(2)}%`)}
        ${currencyRows}
      </table>
    </div>
  `
}
