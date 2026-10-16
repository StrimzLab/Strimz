import { describe, expect, it } from 'vitest'
import { meanAndStddev, sameHourBaseline } from '../../src/capabilities/cashflow/hourly-baseline.js'

const hourStart = new Date('2026-09-15T09:00:00.000Z')
const iso = (day: number) => `2026-09-${String(day).padStart(2, '0')}T09:00:00.000Z`

describe('sameHourBaseline', () => {
  it('takes the same hour on each prior day and never the hour under test', () => {
    const revenueByHour = new Map([
      [iso(15), 999n],
      [iso(14), 10n],
      [iso(13), 20n],
    ])
    const samples = sameHourBaseline({
      hourStart,
      firstActivityAt: new Date('2026-09-13T09:30:00.000Z'),
      revenueByHour,
      days: 30,
    })
    expect(samples).toEqual([10n, 20n])
  })

  it('fills hours without revenue with zero from the first activity onwards', () => {
    const samples = sameHourBaseline({
      hourStart,
      firstActivityAt: new Date('2026-09-11T03:00:00.000Z'),
      revenueByHour: new Map([[iso(13), 7n]]),
      days: 30,
    })
    expect(samples).toEqual([0n, 7n, 0n, 0n])
  })

  it('stops at the configured number of days', () => {
    const samples = sameHourBaseline({
      hourStart,
      firstActivityAt: new Date('2025-01-01T00:00:00.000Z'),
      revenueByHour: new Map(),
      days: 30,
    })
    expect(samples).toHaveLength(30)
  })

  it('is empty for a merchant with no activity', () => {
    expect(
      sameHourBaseline({ hourStart, firstActivityAt: null, revenueByHour: new Map(), days: 30 }),
    ).toEqual([])
  })
})

describe('meanAndStddev', () => {
  it('returns the mean and population standard deviation', () => {
    expect(meanAndStddev([0n, 100n])).toEqual({ mean: 50, stddev: 50 })
  })

  it('is zero for no samples', () => {
    expect(meanAndStddev([])).toEqual({ mean: 0, stddev: 0 })
  })
})
