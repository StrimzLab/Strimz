import { describe, expect, it } from 'vitest'

import { billingLabel, planPriceLabel } from '@/lib/plans-view'

describe('billingLabel', () => {
  it.each([
    ['daily', 1, 'every day'],
    ['weekly', 1, 'every week'],
    ['monthly', 1, 'every month'],
    ['quarterly', 1, 'every quarter'],
    ['yearly', 1, 'every year'],
    ['monthly', 3, 'every 3 months'],
    ['daily', 14, 'every 14 days'],
    ['quarterly', 2, 'every 2 quarters'],
  ] as const)('labels %s × %d as %j', (interval, count, label) => {
    expect(billingLabel(interval, count)).toBe(label)
  })
})

describe('planPriceLabel', () => {
  it('reads as a price per interval in the plan currency', () => {
    expect(
      planPriceLabel({
        amount: '29000000',
        currency: 'EURC',
        interval: 'monthly',
        intervalCount: 1,
      }),
    ).toBe('29 EURC every month')
  })
})
