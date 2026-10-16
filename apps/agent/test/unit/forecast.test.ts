import { describe, expect, it } from 'vitest'
import { forecastDailyRevenue } from '../../src/capabilities/pricing/forecast.js'

const series = (values: Record<string, bigint>) => new Map(Object.entries(values))

describe('forecastDailyRevenue', () => {
  it('returns a low-confidence zero forecast with fewer than 7 revenue days', () => {
    const daily = series({ '2026-09-01': 5n, '2026-09-02': 5n })
    expect(forecastDailyRevenue(daily, '2026-09-10')).toEqual({
      confidence: 'low',
      next30: 0n,
      next60: 0n,
      next90: 0n,
    })
  })

  it('sums each projected day instead of multiplying the last one', () => {
    const daily = new Map<string, bigint>()
    for (let x = 0; x < 10; x++)
      daily.set(`2026-09-${String(x + 1).padStart(2, '0')}`, BigInt(1 + x))
    const f = forecastDailyRevenue(daily, '2026-09-10')
    expect(f.next30).toBe(765n)
    expect(f.next60).toBe(2430n)
    expect(f.next90).toBe(4995n)
  })

  it('treats calendar days without revenue as zero', () => {
    const daily = new Map<string, bigint>()
    for (let day = 1; day <= 19; day += 2)
      daily.set(`2026-09-${String(day).padStart(2, '0')}`, 10_000_000n)
    expect(forecastDailyRevenue(daily, '2026-09-19').next30).toBe(157_894_737n)
  })

  it('floors each projected day at zero on a falling trend', () => {
    const daily = new Map<string, bigint>()
    for (let x = 0; x < 10; x++)
      daily.set(`2026-09-${String(x + 1).padStart(2, '0')}`, BigInt(10 - x))
    expect(forecastDailyRevenue(daily, '2026-09-10').next30).toBe(0n)
  })

  it('sets confidence from the number of revenue days', () => {
    const daily = new Map<string, bigint>()
    const start = Date.UTC(2026, 5, 1)
    for (let i = 0; i < 30; i++) {
      daily.set(new Date(start + i * 86_400_000).toISOString().slice(0, 10), 1n)
    }
    expect(forecastDailyRevenue(daily, '2026-06-30').confidence).toBe('medium')
  })

  it('refuses revenue dated after the last forecast day', () => {
    const daily = new Map<string, bigint>()
    for (let day = 20; day <= 26; day++) daily.set(`2026-09-${day}`, 1n)
    expect(() => forecastDailyRevenue(daily, '2026-09-10')).toThrow(/after the last forecast day/)
  })
})
