import { describe, expect, it } from 'vitest'
import { bucketDailyTotals, formatCurrencyTotals, sumByCurrency } from '../currency-totals'

const row = (amount: string, currency: string) => ({ amount, currency })

describe('sumByCurrency', () => {
  it('keeps USDC and EURC in separate totals', () => {
    const totals = sumByCurrency(
      [row('1500000', 'USDC'), row('2000000', 'EURC'), row('250000', 'USDC')],
      (r) => r,
    )
    expect(totals).toEqual([
      { currency: 'USDC', amount: 1_750_000n },
      { currency: 'EURC', amount: 2_000_000n },
    ])
  })

  it('sums in base units without floating point loss', () => {
    const totals = sumByCurrency([row('9007199254740993', 'USDC'), row('1', 'USDC')], (r) => r)
    expect(totals).toEqual([{ currency: 'USDC', amount: 9_007_199_254_740_994n }])
  })

  it('returns no totals for no rows', () => {
    expect(sumByCurrency([], (r: { amount: string; currency: string }) => r)).toEqual([])
  })
})

describe('formatCurrencyTotals', () => {
  it('lists each currency on its own', () => {
    expect(
      formatCurrencyTotals([
        { currency: 'USDC', amount: 1_750_000n },
        { currency: 'EURC', amount: 2_000_000n },
      ]),
    ).toBe('1.75 USDC · 2 EURC')
  })

  it('shows zero in the given currency when there is nothing', () => {
    expect(formatCurrencyTotals([], 'USDC')).toBe('0 USDC')
  })
})

describe('bucketDailyTotals', () => {
  const now = Date.UTC(2026, 9, 3, 15, 0, 0)

  it('buckets amounts per UTC day and per currency, oldest day first', () => {
    const buckets = bucketDailyTotals(
      [
        { at: '2026-10-03T01:00:00.000Z', amount: '1000000', currency: 'USDC' },
        { at: '2026-10-03T09:00:00.000Z', amount: '2000000', currency: 'EURC' },
        { at: '2026-10-02T23:59:59.000Z', amount: '500000', currency: 'USDC' },
        { at: '2026-09-01T00:00:00.000Z', amount: '7000000', currency: 'USDC' },
      ],
      now,
      3,
    )
    expect(buckets.map((b) => b.dayStart)).toEqual([
      Date.UTC(2026, 9, 1),
      Date.UTC(2026, 9, 2),
      Date.UTC(2026, 9, 3),
    ])
    expect(buckets[0]).toEqual({ dayStart: Date.UTC(2026, 9, 1), count: 0, totals: {} })
    expect(buckets[1]).toEqual({
      dayStart: Date.UTC(2026, 9, 2),
      count: 1,
      totals: { USDC: 500_000n },
    })
    expect(buckets[2]).toEqual({
      dayStart: Date.UTC(2026, 9, 3),
      count: 2,
      totals: { USDC: 1_000_000n, EURC: 2_000_000n },
    })
  })
})
