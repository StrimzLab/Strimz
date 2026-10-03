import { formatTokenAmount } from './format'

export interface CurrencyTotal {
  currency: string
  amount: bigint
}

const CURRENCY_ORDER = ['USDC', 'EURC']

function currencyRank(currency: string): number {
  const index = CURRENCY_ORDER.indexOf(currency)
  return index === -1 ? CURRENCY_ORDER.length : index
}

export function sumByCurrency<T>(
  rows: readonly T[],
  pick: (row: T) => { amount: string; currency: string },
): CurrencyTotal[] {
  const totals = new Map<string, bigint>()
  for (const row of rows) {
    const { amount, currency } = pick(row)
    totals.set(currency, (totals.get(currency) ?? 0n) + BigInt(amount))
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort(
      (a, b) =>
        currencyRank(a.currency) - currencyRank(b.currency) || a.currency.localeCompare(b.currency),
    )
}

export function formatCurrencyTotals(totals: readonly CurrencyTotal[], emptyCurrency = 'USDC') {
  if (totals.length === 0) return formatTokenAmount('0', emptyCurrency)
  return totals.map((t) => formatTokenAmount(t.amount.toString(), t.currency)).join(' · ')
}

export interface DailyTotals {
  dayStart: number
  count: number
  totals: Record<string, bigint>
}

const DAY_MS = 86_400_000

export function bucketDailyTotals(
  rows: readonly { at: string; amount: string; currency: string }[],
  nowMs: number,
  days: number,
): DailyTotals[] {
  const today = Math.floor(nowMs / DAY_MS) * DAY_MS
  const first = today - (days - 1) * DAY_MS
  const buckets: DailyTotals[] = Array.from({ length: days }, (_, i) => ({
    dayStart: first + i * DAY_MS,
    count: 0,
    totals: {},
  }))
  for (const row of rows) {
    const dayStart = Math.floor(new Date(row.at).getTime() / DAY_MS) * DAY_MS
    const bucket = buckets[(dayStart - first) / DAY_MS]
    if (!bucket || bucket.dayStart !== dayStart) continue
    bucket.count += 1
    bucket.totals[row.currency] = (bucket.totals[row.currency] ?? 0n) + BigInt(row.amount)
  }
  return buckets
}
