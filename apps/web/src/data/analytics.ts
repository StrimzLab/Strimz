import { CUSTOMERS } from './customers'
import { mulberry32, range } from './_seed'

const rng = mulberry32(7)

const ANCHOR = new Date('2026-05-01T00:00:00Z').getTime()

function dayString(daysAgo: number): string {
  return new Date(ANCHOR - daysAgo * 86_400_000).toISOString().slice(0, 10)
}

export type DailyVolumePoint = {
  day: string
  grossUsdc: number
  feeUsdc: number
  netUsdc: number
  transactionCount: number
  newCustomers: number
}

export const DAILY_VOLUME: DailyVolumePoint[] = range(60).map((i) => {
  const trend = 1 + i * 0.012
  const noise = 0.7 + rng() * 0.6
  const gross = Math.round(800_000_000 * trend * noise)
  const fee = Math.round(gross * 0.005)
  return {
    day: dayString(60 - i - 1),
    grossUsdc: gross,
    feeUsdc: fee,
    netUsdc: gross - fee,
    transactionCount: Math.round(15 * trend * noise),
    newCustomers: Math.round(2 + rng() * 4 * trend),
  }
})

export type ConversionPoint = { day: string; created: number; confirmed: number; rate: number }

export const CONVERSION: ConversionPoint[] = range(30).map((i) => {
  const created = Math.round(20 + rng() * 30)
  const confirmed = Math.round(created * (0.62 + rng() * 0.28))
  return {
    day: dayString(30 - i - 1),
    created,
    confirmed,
    rate: confirmed / created,
  }
})

export type ChurnPoint = { month: string; churnRate: number }

export const CHURN: ChurnPoint[] = range(12).map((i) => {
  const date = new Date(ANCHOR)
  date.setMonth(date.getMonth() - (11 - i))
  return {
    month: date.toISOString().slice(0, 7),
    churnRate: 0.04 + rng() * 0.04 - i * 0.0015,
  }
})

export type MrrPoint = { month: string; mrrUsdc: number; activeSubscribers: number }

export const MRR_HISTORY: MrrPoint[] = range(12).map((i) => {
  const date = new Date(ANCHOR)
  date.setMonth(date.getMonth() - (11 - i))
  const subs = Math.round(8 + i * 4 + rng() * 5)
  return {
    month: date.toISOString().slice(0, 7),
    mrrUsdc: subs * Math.round((24_000_000 + rng() * 12_000_000)),
    activeSubscribers: subs,
  }
})

export const CURRENT_MRR_USDC = MRR_HISTORY[MRR_HISTORY.length - 1]!.mrrUsdc
export const ACTIVE_SUBSCRIBERS = MRR_HISTORY[MRR_HISTORY.length - 1]!.activeSubscribers

export const TOP_CUSTOMERS_LTV = [...CUSTOMERS]
  .sort((a, b) => b.totalSpentUsdc - a.totalSpentUsdc)
  .slice(0, 10)

export type ForecastPoint = { day: string; projectedNetUsdc: number }

export const FORECAST_NEXT_30: ForecastPoint[] = (() => {
  const last = DAILY_VOLUME.slice(-30)
  const avg = last.reduce((s, p) => s + p.netUsdc, 0) / last.length
  const slope = (last[last.length - 1]!.netUsdc - last[0]!.netUsdc) / last.length
  return range(30).map((i) => ({
    day: dayString(-i - 1),
    projectedNetUsdc: Math.round(avg + slope * i + (rng() - 0.5) * avg * 0.05),
  }))
})()

export const FORECAST_CONFIDENCE: 'low' | 'medium' | 'high' = 'high'
