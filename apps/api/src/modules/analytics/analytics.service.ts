import { BadRequestException, Injectable } from '@nestjs/common'
import { z } from 'zod'
import {
  idSchema,
  invoiceStatusSchema,
  paymentCurrencies,
  paymentCurrencySchema,
  paymentSessionStatusSchema,
  refundStatusSchema,
  resolveStatsVolumeRange,
  subscriptionStatusSchema,
  tokenAmountSchema,
  type CurrencyAmounts,
  type Forecast,
  type Mode,
  type PaymentCurrency,
  type StatsForecast,
  type StatsLtv,
  type StatsLtvQueryParsed,
  type StatsMrr,
  type StatsSummary,
  type StatsVolume,
  type StatsVolumeQuery,
  type VolumeWindow,
} from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { toCurrencyAmounts } from '../../common/money/currency-amounts.js'

export interface DateRange {
  from?: string
  to?: string
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Conversion rate: (sessions that ended in `confirmed`) / (sessions created)
   * Returned as daily buckets across the requested range.
   */
  async conversion(merchantId: string, mode: Mode, range: DateRange) {
    const from = range.from ? new Date(range.from) : new Date(Date.now() - 30 * 86_400_000)
    const to = range.to ? new Date(range.to) : new Date()
    type Row = { day: Date; created: bigint; confirmed: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT
         date_trunc('day', "createdAt")        AS day,
         count(*)                              AS created,
         count(*) FILTER (WHERE status='confirmed') AS confirmed
       FROM "PaymentSession"
       WHERE "merchantId" = $1 AND mode = $4::"Mode" AND "createdAt" BETWEEN $2 AND $3
       GROUP BY day
       ORDER BY day ASC`,
      merchantId,
      from,
      to,
      mode,
    )) as Row[]
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      data: rows.map((r: Row) => ({
        day: r.day.toISOString().slice(0, 10),
        created: Number(r.created),
        confirmed: Number(r.confirmed),
        rate: Number(r.created) === 0 ? 0 : Number(r.confirmed) / Number(r.created),
      })),
    }
  }

  /**
   * Subscription churn rate per month. churn = cancelled / (active + cancelled)
   * computed at the end of each month.
   */
  async churn(merchantId: string, mode: Mode, range: DateRange) {
    const from = range.from ? new Date(range.from) : new Date(Date.now() - 365 * 86_400_000)
    const to = range.to ? new Date(range.to) : new Date()
    type Row = { month: Date; cancelled: bigint; total: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT
         date_trunc('month', "createdAt") AS month,
         count(*) FILTER (WHERE status IN ('cancelled','lapsed')) AS cancelled,
         count(*) AS total
       FROM "Subscription"
       WHERE "merchantId" = $1 AND mode = $4::"Mode" AND "createdAt" BETWEEN $2 AND $3
       GROUP BY month
       ORDER BY month ASC`,
      merchantId,
      from,
      to,
      mode,
    )) as Row[]
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      data: rows.map((r: Row) => ({
        month: r.month.toISOString().slice(0, 7),
        cancelled: Number(r.cancelled),
        total: Number(r.total),
        rate: Number(r.total) === 0 ? 0 : Number(r.cancelled) / Number(r.total),
      })),
    }
  }

  /**
   * Monthly Recurring Revenue: sum of active-subscription amounts, normalised
   * to monthly. Daily/weekly/quarterly/yearly all converted to a monthly value.
   */
  async mrr(merchantId: string, mode: Mode): Promise<StatsMrr> {
    const subs = await this.prisma.db.subscription.findMany({
      where: { merchantId, mode, status: 'active' },
      select: { amount: true, interval: true, intervalCount: true, currency: true },
    })
    const monthly = new Map<PaymentCurrency, bigint>()
    for (const s of subs) {
      const amount = normaliseToMonthly(BigInt(s.amount), s.interval, s.intervalCount)
      monthly.set(s.currency, (monthly.get(s.currency) ?? 0n) + amount)
    }
    return {
      mrr: toCurrencyAmounts(
        [...monthly].map(([currency, amount]) => ({ currency, amount: amount.toString() })),
      ),
      activeSubscribers: subs.length,
    }
  }

  /**
   * Customer Lifetime Value — total spend per unique customer, paginated.
   */
  async ltv(merchantId: string, mode: Mode, params: StatsLtvQueryParsed): Promise<StatsLtv> {
    const after = params.cursor ? decodeLtvCursor(params.cursor) : null
    type Row = { customerId: string; totalSpend: string; transactionCount: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `WITH spend AS (
         SELECT COALESCE(t."customerId", ps."customerId", s."customerId") AS "customerId",
                sum(t."amount"::numeric) AS total,
                count(*) AS "transactionCount"
         FROM "Transaction" t
         LEFT JOIN "PaymentSession" ps ON ps.id = t."sessionId"
         LEFT JOIN "Subscription" s ON s.id = t."subscriptionId"
         WHERE t."merchantId" = $1 AND t.mode = $2::"Mode" AND t.currency = $3::"PaymentCurrency"
           AND t.status = 'confirmed' AND t.kind <> 'refund'
         GROUP BY 1
       )
       SELECT "customerId", total::text AS "totalSpend", "transactionCount"
       FROM spend
       WHERE "customerId" IS NOT NULL
         AND ($4::numeric IS NULL OR total < $4::numeric OR (total = $4::numeric AND "customerId" > $5))
       ORDER BY total DESC, "customerId" ASC
       LIMIT $6`,
      merchantId,
      mode,
      params.currency,
      after?.totalSpend ?? null,
      after?.customerId ?? null,
      params.limit + 1,
    )) as Row[]
    const hasMore = rows.length > params.limit
    const page = hasMore ? rows.slice(0, params.limit) : rows
    const last = page.at(-1)
    return {
      currency: params.currency,
      data: page.map((r: Row) => ({
        customerId: r.customerId,
        totalSpend: r.totalSpend,
        transactionCount: Number(r.transactionCount),
      })),
      nextCursor: hasMore && last ? encodeLtvCursor(last.totalSpend, last.customerId) : null,
      hasMore,
    }
  }

  /**
   * 30/60/90-day revenue forecast based on a simple linear regression over
   * the last 90 days of confirmed transactions. Good enough for a "next
   * quarter" merchant signal; if we want more we'll plug in time-series
   * later.
   */
  async forecast(merchantId: string, mode: Mode): Promise<StatsForecast> {
    type Row = { day: string | null; currency: string; net: string }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT to_char(date_trunc('day', "blockTimestamp"), 'YYYY-MM-DD') AS day,
              currency::text AS currency,
              sum("netAmount"::numeric)::text AS net
       FROM "Transaction"
       WHERE "merchantId" = $1 AND mode = $2::"Mode" AND status = 'confirmed' AND kind <> 'refund'
         AND "blockTimestamp" >= now() - interval '90 days'
       GROUP BY GROUPING SETS ((date_trunc('day', "blockTimestamp"), currency), (currency))`,
      merchantId,
      mode,
    )) as Row[]
    const last90 = toCurrencyAmounts(
      rows.filter((r) => r.day === null).map((r) => ({ currency: r.currency, amount: r.net })),
    )
    const yesterday = utcDayKey(new Date(Date.now() - DAY_MS))
    const byCurrency = {} as Record<PaymentCurrency, Forecast>
    for (const currency of paymentCurrencies) {
      const daily = new Map<string, bigint>()
      for (const r of rows) {
        if (r.day !== null && r.currency === currency) daily.set(r.day, BigInt(r.net))
      }
      byCurrency[currency] = forecastCurrency(daily, yesterday, last90[currency])
    }
    return { byCurrency }
  }

  async summary(merchantId: string, mode: Mode): Promise<StatsSummary> {
    const [volume, paymentSessions, invoices, refunds, subscriptions, customers] =
      await Promise.all([
        this.summaryVolume(merchantId, mode),
        this.summarySessions(merchantId, mode),
        this.summaryInvoices(merchantId, mode),
        this.summaryRefunds(merchantId, mode),
        this.summarySubscriptions(merchantId, mode),
        this.prisma.db.customer.count({ where: { merchantId } }),
      ])
    return {
      mode,
      generatedAt: new Date().toISOString(),
      volume,
      paymentSessions,
      invoices,
      refunds,
      subscriptions,
      customers: { total: customers },
    }
  }

  async volume(merchantId: string, mode: Mode, query: StatsVolumeQuery): Promise<StatsVolume> {
    const { from, to } = resolveStatsVolumeRange(query)
    type Row = {
      day: string
      currency: string
      count: bigint
      gross: string
      fees: string
      net: string
    }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT to_char(date_trunc('day', "blockTimestamp"), 'YYYY-MM-DD') AS day,
              currency::text AS currency,
              count(*) AS count,
              sum("amount"::numeric)::text AS gross,
              sum("feeAmount"::numeric)::text AS fees,
              sum("netAmount"::numeric)::text AS net
       FROM "Transaction"
       WHERE "merchantId" = $1 AND mode = $2::"Mode" AND status = 'confirmed' AND kind <> 'refund'
         AND "blockTimestamp" BETWEEN $3 AND $4
       GROUP BY date_trunc('day', "blockTimestamp"), currency
       ORDER BY date_trunc('day', "blockTimestamp") ASC, "Transaction".currency ASC`,
      merchantId,
      mode,
      from,
      to,
    )) as Row[]
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      data: rows.map((r) => ({
        day: r.day,
        currency: parseCurrency(r.currency),
        count: Number(r.count),
        gross: r.gross,
        fees: r.fees,
        net: r.net,
      })),
    }
  }

  private async summaryVolume(merchantId: string, mode: Mode): Promise<StatsSummary['volume']> {
    const windows = { last7d: '7 days', last30d: '30 days', allTime: null } as const
    const columns = Object.entries(windows).flatMap(([key, interval]) => {
      const filter = interval
        ? `FILTER (WHERE "blockTimestamp" >= now() - interval '${interval}')`
        : ''
      return [
        `count(*) ${filter} AS "${key}_count"`,
        `coalesce(sum("amount"::numeric) ${filter}, 0)::text AS "${key}_gross"`,
        `coalesce(sum("feeAmount"::numeric) ${filter}, 0)::text AS "${key}_fees"`,
        `coalesce(sum("netAmount"::numeric) ${filter}, 0)::text AS "${key}_net"`,
      ]
    })
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT currency::text AS currency, ${columns.join(', ')}
       FROM "Transaction"
       WHERE "merchantId" = $1 AND mode = $2::"Mode" AND status = 'confirmed' AND kind <> 'refund'
       GROUP BY currency`,
      merchantId,
      mode,
    )) as AggregateRow[]
    const window = (key: keyof typeof windows): VolumeWindow => ({
      count: sumCounts(rows, `${key}_count`),
      gross: amountsOf(rows, `${key}_gross`),
      fees: amountsOf(rows, `${key}_fees`),
      net: amountsOf(rows, `${key}_net`),
    })
    return { last7d: window('last7d'), last30d: window('last30d'), allTime: window('allTime') }
  }

  private async summarySessions(
    merchantId: string,
    mode: Mode,
  ): Promise<StatsSummary['paymentSessions']> {
    const statuses = paymentSessionStatusSchema.options
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT currency::text AS currency, count(*) AS total, ${statusCountColumns(statuses)},
              coalesce(sum("amount"::numeric) FILTER (WHERE status = 'confirmed'), 0)::text AS "confirmedAmount"
       FROM "PaymentSession"
       WHERE "merchantId" = $1 AND mode = $2::"Mode"
       GROUP BY currency`,
      merchantId,
      mode,
    )) as AggregateRow[]
    const byStatus = statusCounts(statuses, rows)
    return {
      total: sumCounts(rows, 'total'),
      byStatus,
      confirmed: { count: byStatus.confirmed, amount: amountsOf(rows, 'confirmedAmount') },
    }
  }

  private async summaryInvoices(merchantId: string, mode: Mode): Promise<StatsSummary['invoices']> {
    const statuses = invoiceStatusSchema.options
    const paid30 = `status = 'paid' AND "paidAt" >= now() - interval '30 days'`
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT currency::text AS currency, count(*) AS total, ${statusCountColumns(statuses)},
              count(*) FILTER (WHERE status IN ('sent', 'overdue')) AS "outstandingCount",
              coalesce(sum("total"::numeric) FILTER (WHERE status IN ('sent', 'overdue')), 0)::text AS "outstandingAmount",
              coalesce(sum("total"::numeric) FILTER (WHERE status = 'overdue'), 0)::text AS "overdueAmount",
              count(*) FILTER (WHERE ${paid30}) AS "paidLast30dCount",
              coalesce(sum("total"::numeric) FILTER (WHERE ${paid30}), 0)::text AS "paidLast30dAmount"
       FROM "Invoice"
       WHERE "merchantId" = $1 AND mode = $2::"Mode"
       GROUP BY currency`,
      merchantId,
      mode,
    )) as AggregateRow[]
    const byStatus = statusCounts(statuses, rows)
    return {
      byStatus,
      outstanding: {
        count: sumCounts(rows, 'outstandingCount'),
        amount: amountsOf(rows, 'outstandingAmount'),
      },
      overdue: { count: byStatus.overdue, amount: amountsOf(rows, 'overdueAmount') },
      paidLast30d: {
        count: sumCounts(rows, 'paidLast30dCount'),
        amount: amountsOf(rows, 'paidLast30dAmount'),
      },
    }
  }

  private async summaryRefunds(merchantId: string, mode: Mode): Promise<StatsSummary['refunds']> {
    const statuses = refundStatusSchema.options
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT currency::text AS currency, count(*) AS total, ${statusCountColumns(statuses)},
              coalesce(sum("amount"::numeric) FILTER (WHERE status = 'completed'), 0)::text AS "completedAmount"
       FROM "Refund"
       WHERE "merchantId" = $1 AND mode = $2::"Mode"
       GROUP BY currency`,
      merchantId,
      mode,
    )) as AggregateRow[]
    const byStatus = statusCounts(statuses, rows)
    return {
      byStatus,
      completed: { count: byStatus.completed, amount: amountsOf(rows, 'completedAmount') },
    }
  }

  private async summarySubscriptions(
    merchantId: string,
    mode: Mode,
  ): Promise<StatsSummary['subscriptions']> {
    const statuses = subscriptionStatusSchema.options
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT count(*) AS total, ${statusCountColumns(statuses)}
       FROM "Subscription"
       WHERE "merchantId" = $1 AND mode = $2::"Mode"`,
      merchantId,
      mode,
    )) as AggregateRow[]
    return { total: sumCounts(rows, 'total'), byStatus: statusCounts(statuses, rows) }
  }
}

const DAY_MS = 86_400_000

type AggregateRow = Record<string, unknown>

function parseCurrency(value: string): PaymentCurrency {
  const parsed = paymentCurrencySchema.safeParse(value)
  if (!parsed.success)
    throw new Error(`unknown currency in aggregate row: ${JSON.stringify(value)}`)
  return parsed.data
}

function countOf(row: AggregateRow, column: string): number {
  const value = row[column]
  if (typeof value !== 'bigint') {
    throw new Error(`aggregate column ${column} is not a count`)
  }
  return Number(value)
}

function sumCounts(rows: readonly AggregateRow[], column: string): number {
  return rows.reduce((total, row) => total + countOf(row, column), 0)
}

function amountsOf(rows: readonly AggregateRow[], column: string): CurrencyAmounts {
  return toCurrencyAmounts(
    rows.map((row) => {
      const currency = row.currency
      const amount = row[column]
      if (typeof currency !== 'string' || typeof amount !== 'string') {
        throw new Error(`aggregate column ${column} is not a currency amount`)
      }
      return { currency, amount }
    }),
  )
}

function statusCountColumns(statuses: readonly string[]): string {
  return statuses.map((s) => `count(*) FILTER (WHERE status = '${s}') AS "status_${s}"`).join(', ')
}

function statusCounts<T extends string>(
  statuses: readonly T[],
  rows: readonly AggregateRow[],
): Record<T, number> {
  const out = {} as Record<T, number>
  let counted = 0
  for (const status of statuses) {
    out[status] = sumCounts(rows, `status_${status}`)
    counted += out[status]
  }
  const total = sumCounts(rows, 'total')
  if (counted !== total) {
    throw new Error(`status counts cover ${counted} of ${total} rows; a status is missing`)
  }
  return out
}

const ltvCursorSchema = z.object({ s: tokenAmountSchema, c: idSchema }).strict()

function encodeLtvCursor(totalSpend: string, customerId: string): string {
  return Buffer.from(JSON.stringify({ s: totalSpend, c: customerId })).toString('base64url')
}

function decodeLtvCursor(cursor: string): { totalSpend: string; customerId: string } {
  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    throw invalidCursor()
  }
  const parsed = ltvCursorSchema.safeParse(decoded)
  if (!parsed.success) throw invalidCursor()
  return { totalSpend: parsed.data.s, customerId: parsed.data.c }
}

function invalidCursor() {
  return new BadRequestException({
    code: 'invalid_request',
    message: 'cursor: not a cursor returned by this endpoint',
    param: 'cursor',
  })
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function forecastCurrency(
  daily: ReadonlyMap<string, bigint>,
  lastDay: string,
  last90DayRevenue: string,
): Forecast {
  const revenueDays = daily.size
  const confidence = revenueDays >= 60 ? 'high' : revenueDays >= 30 ? 'medium' : 'low'
  if (revenueDays < 7) {
    return { confidence: 'low', last90DayRevenue, next30: '0', next60: '0', next90: '0' }
  }
  const firstDay = [...daily.keys()].sort()[0] as string
  const ys: number[] = []
  for (
    let day = Date.parse(`${firstDay}T00:00:00.000Z`);
    day <= Date.parse(`${lastDay}T00:00:00.000Z`);
    day += DAY_MS
  ) {
    ys.push(Number(daily.get(utcDayKey(new Date(day))) ?? 0n))
  }
  const xs = ys.map((_y, i) => i)
  const { slope, intercept } = linearRegression(xs, ys)
  const project = (days: number) => {
    let total = 0
    for (let k = 0; k < days; k++) {
      total += Math.max(0, slope * (ys.length + k) + intercept)
    }
    return BigInt(Math.round(total)).toString()
  }
  return {
    confidence,
    last90DayRevenue,
    next30: project(30),
    next60: project(60),
    next90: project(90),
  }
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

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length
  const sumX = xs.reduce((a: number, b: number) => a + b, 0)
  const sumY = ys.reduce((a: number, b: number) => a + b, 0)
  const sumXY = xs.reduce((acc: number, x: number, i: number) => acc + x * (ys[i] ?? 0), 0)
  const sumXX = xs.reduce((acc: number, x: number) => acc + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}
