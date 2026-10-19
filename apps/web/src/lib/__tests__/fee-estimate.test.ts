import { describe, expect, it } from 'vitest'
import { firstYearFees, planAfterYear, planAtVolume } from '../fee-estimate'

describe('firstYearFees', () => {
  it('charges nothing on the first $1,000 and 0.5% after it', () => {
    expect(firstYearFees(1_000).fees).toBe(55)
  })

  it('drops to 0.4% once all-time volume passes $50,000', () => {
    expect(firstYearFees(10_000).fees).toBe(525)
  })

  it('splits a month that crosses a threshold', () => {
    expect(firstYearFees(600).fees).toBe(31)
  })

  it('reports what the business keeps and the effective rate', () => {
    const year = firstYearFees(10_000)
    expect(year.processed).toBe(120_000)
    expect(year.kept).toBe(119_475)
    expect(year.effectiveRate).toBeCloseTo(0.4375, 4)
  })

  it('returns zero for no volume', () => {
    expect(firstYearFees(0)).toEqual({ processed: 0, fees: 0, kept: 0, effectiveRate: 0 })
  })
})

describe('planAtVolume', () => {
  it.each([
    [0, 'free'],
    [999.99, 'free'],
    [1_000, 'starter'],
    [49_999.99, 'starter'],
    [50_000, 'growth'],
    [1_000_000, 'growth'],
  ] as const)('puts $%s of all-time volume on %s', (volume, plan) => {
    expect(planAtVolume(volume)).toBe(plan)
  })
})

describe('planAfterYear', () => {
  it('follows twelve months of steady volume', () => {
    expect(planAfterYear(50)).toBe('free')
    expect(planAfterYear(500)).toBe('starter')
    expect(planAfterYear(10_000)).toBe('growth')
  })
})
