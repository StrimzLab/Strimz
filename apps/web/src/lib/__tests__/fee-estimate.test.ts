import { describe, expect, it } from 'vitest'
import { firstYearFees } from '../fee-estimate'

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
