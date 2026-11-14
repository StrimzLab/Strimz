import { describe, expect, it } from 'vitest'
import {
  bucketVolumeDays,
  currencyAmountsToTotals,
  formatCurrencyAmounts,
  formatCurrencyTotals,
} from '../currency-totals'

describe('currencyAmountsToTotals', () => {
  it('keeps USDC and EURC apart and drops zero currencies', () => {
    expect(currencyAmountsToTotals({ USDC: '1750000', EURC: '2000000' })).toEqual([
      { currency: 'USDC', amount: 1_750_000n },
      { currency: 'EURC', amount: 2_000_000n },
    ])
    expect(currencyAmountsToTotals({ USDC: '0', EURC: '9007199254740993' })).toEqual([
      { currency: 'EURC', amount: 9_007_199_254_740_993n },
    ])
    expect(currencyAmountsToTotals({ USDC: '0', EURC: '0' })).toEqual([])
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

describe('formatCurrencyAmounts', () => {
  it('hides a zero currency unless both are zero', () => {
    expect(formatCurrencyAmounts({ USDC: '0', EURC: '2000000' })).toBe('2 EURC')
    expect(formatCurrencyAmounts({ USDC: '1500000', EURC: '2000000' })).toBe('1.5 USDC · 2 EURC')
    expect(formatCurrencyAmounts({ USDC: '0', EURC: '0' })).toBe('0 USDC')
  })
})

describe('bucketVolumeDays', () => {
  const now = Date.UTC(2026, 9, 3, 15, 0, 0)
  const day = (d: string, currency: 'USDC' | 'EURC', gross: string, count: number) => ({
    day: d,
    currency,
    count,
    gross,
    fees: '0',
    net: gross,
  })

  it('places server rows on UTC days, oldest first, and fills empty days', () => {
    const buckets = bucketVolumeDays(
      [
        day('2026-09-01', 'USDC', '7000000', 1),
        day('2026-10-02', 'USDC', '500000', 1),
        day('2026-10-03', 'USDC', '1000000', 1),
        day('2026-10-03', 'EURC', '2000000', 2),
      ],
      now,
      3,
    )
    expect(buckets).toEqual([
      { dayStart: Date.UTC(2026, 9, 1), count: 0, totals: {} },
      { dayStart: Date.UTC(2026, 9, 2), count: 1, totals: { USDC: 500_000n } },
      {
        dayStart: Date.UTC(2026, 9, 3),
        count: 3,
        totals: { USDC: 1_000_000n, EURC: 2_000_000n },
      },
    ])
  })

  it('refuses two rows for the same day and currency instead of adding them', () => {
    expect(() =>
      bucketVolumeDays(
        [day('2026-10-03', 'USDC', '1', 1), day('2026-10-03', 'USDC', '2', 1)],
        now,
        3,
      ),
    ).toThrow(/more than one USDC volume row/)
  })
})
