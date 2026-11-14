import { paymentCurrencies, type CurrencyAmounts, type StatsVolumeDay } from '@strimz/shared-types'
import { formatTokenAmount } from './format'

export interface CurrencyTotal {
  currency: string
  amount: bigint
}

export function currencyAmountsToTotals(amounts: CurrencyAmounts): CurrencyTotal[] {
  return paymentCurrencies
    .map((currency) => ({ currency, amount: BigInt(amounts[currency]) }))
    .filter((total) => total.amount !== 0n)
}

export function formatCurrencyTotals(totals: readonly CurrencyTotal[], emptyCurrency = 'USDC') {
  if (totals.length === 0) return formatTokenAmount('0', emptyCurrency)
  return totals.map((t) => formatTokenAmount(t.amount.toString(), t.currency)).join(' · ')
}

export function formatCurrencyAmounts(amounts: CurrencyAmounts): string {
  return formatCurrencyTotals(currencyAmountsToTotals(amounts))
}

export interface DailyTotals {
  dayStart: number
  count: number
  totals: Record<string, bigint>
}

const DAY_MS = 86_400_000

export function utcDayStart(nowMs: number, daysBack = 0): number {
  return Math.floor(nowMs / DAY_MS) * DAY_MS - daysBack * DAY_MS
}

export function bucketVolumeDays(
  rows: readonly StatsVolumeDay[],
  nowMs: number,
  days: number,
): DailyTotals[] {
  const first = utcDayStart(nowMs, days - 1)
  const buckets: DailyTotals[] = Array.from({ length: days }, (_, i) => ({
    dayStart: first + i * DAY_MS,
    count: 0,
    totals: {},
  }))
  for (const row of rows) {
    const dayStart = Date.parse(`${row.day}T00:00:00.000Z`)
    const bucket = buckets[(dayStart - first) / DAY_MS]
    if (!bucket || bucket.dayStart !== dayStart) continue
    if (bucket.totals[row.currency] !== undefined) {
      throw new Error(`more than one ${row.currency} volume row for ${row.day}`)
    }
    bucket.count += row.count
    bucket.totals[row.currency] = BigInt(row.gross)
  }
  return buckets
}
