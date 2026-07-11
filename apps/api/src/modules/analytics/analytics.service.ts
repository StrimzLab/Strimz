import { Injectable } from '@nestjs/common'
import type { Mode } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

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
  async mrr(merchantId: string, mode: Mode) {
    const subs = await this.prisma.db.subscription.findMany({
      where: { merchantId, mode, status: 'active' },
      select: { amount: true, interval: true, intervalCount: true, currency: true },
    })
    let mrrUnits = 0n
    for (const s of subs) {
      const amount = BigInt(s.amount)
      const monthly = normaliseToMonthly(amount, s.interval, s.intervalCount)
      mrrUnits += monthly
    }
    return {
      mrr: mrrUnits.toString(),
      activeSubscribers: subs.length,
    }
  }

  /**
   * Customer Lifetime Value — total spend per unique customer, paginated.
   */
  async ltv(merchantId: string, mode: Mode, params: { limit?: number; cursor?: string | null }) {
    const limit = Math.min(params.limit ?? 25, 100)
    type Row = { customerId: string; totalSpend: bigint; transactionCount: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT "customerId", sum(("amount")::numeric)::bigint AS "totalSpend", count(*) AS "transactionCount"
       FROM "Transaction"
       WHERE "merchantId" = $1 AND mode = $3::"Mode" AND "customerId" IS NOT NULL AND status='confirmed'
       GROUP BY "customerId"
       ORDER BY "totalSpend" DESC
       LIMIT $2`,
      merchantId,
      limit,
      mode,
    )) as Row[]
    return {
      data: rows.map((r: Row) => ({
        customerId: r.customerId,
        totalSpend: r.totalSpend.toString(),
        transactionCount: Number(r.transactionCount),
      })),
      nextCursor: null,
      hasMore: false,
    }
  }

  /**
   * 30/60/90-day revenue forecast based on a simple linear regression over
   * the last 90 days of confirmed transactions. Good enough for a "next
   * quarter" merchant signal; if we want more we'll plug in time-series
   * later.
   */
  async forecast(merchantId: string, mode: Mode) {
    const since = new Date(Date.now() - 90 * 86_400_000)
    type Row = { day: Date; revenue: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT date_trunc('day', "blockTimestamp") AS day, sum(("netAmount")::numeric)::bigint AS revenue
       FROM "Transaction"
       WHERE "merchantId" = $1 AND mode = $3::"Mode" AND status='confirmed' AND "blockTimestamp" >= $2
       GROUP BY day
       ORDER BY day ASC`,
      merchantId,
      since,
      mode,
    )) as Row[]
    if (rows.length < 7) {
      return { confidence: 'low', last90DayRevenue: '0', next30: '0', next60: '0', next90: '0' }
    }
    const xs: number[] = rows.map((_r: Row, i: number) => i)
    const ys: number[] = rows.map((r: Row) => Number(r.revenue) / 1_000_000)
    const { slope, intercept } = linearRegression(xs, ys)
    const last = rows.length - 1
    const project = (daysAhead: number) =>
      Math.max(0, Math.round((slope * (last + daysAhead) + intercept) * daysAhead * 1_000_000))
    const total = ys.reduce((a: number, b: number) => a + b, 0) * 1_000_000
    return {
      confidence: rows.length >= 60 ? 'high' : rows.length >= 30 ? 'medium' : 'low',
      last90DayRevenue: Math.round(total).toString(),
      next30: project(30).toString(),
      next60: project(60).toString(),
      next90: project(90).toString(),
    }
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
