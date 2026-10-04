import { describe, expect, it } from 'vitest'
import {
  currencyAmountsSchema,
  paymentCurrencies,
  resolveStatsVolumeRange,
  statsLtvQuerySchema,
  statsSummarySchema,
  statsVolumeQuerySchema,
} from '../src/index.js'

describe('currency amounts', () => {
  it('requires every payment currency and nothing else', () => {
    expect(paymentCurrencies).toEqual(['USDC', 'EURC'])
    expect(currencyAmountsSchema.parse({ USDC: '1', EURC: '0' })).toEqual({ USDC: '1', EURC: '0' })
    expect(currencyAmountsSchema.safeParse({ USDC: '1' }).success).toBe(false)
    expect(currencyAmountsSchema.safeParse({ USDC: '1', EURC: '0', USYC: '0' }).success).toBe(false)
    expect(currencyAmountsSchema.safeParse({ USDC: '-1', EURC: '0' }).success).toBe(false)
  })
})

describe('stats summary', () => {
  it('requires a count for every status', () => {
    const zero = { USDC: '0', EURC: '0' }
    const money = { count: 0, amount: zero }
    const window = { count: 0, gross: zero, fees: zero, net: zero }
    const summary = {
      mode: 'test',
      generatedAt: '2026-10-03T12:00:00.000Z',
      volume: { last7d: window, last30d: window, allTime: window },
      paymentSessions: {
        total: 0,
        byStatus: {
          created: 0,
          awaiting_payment: 0,
          submitted: 0,
          confirmed: 0,
          failed: 0,
          expired: 0,
          cancelled: 0,
        },
        confirmed: money,
      },
      invoices: {
        byStatus: { draft: 0, sent: 0, paid: 0, overdue: 0, void: 0 },
        outstanding: money,
        overdue: money,
        paidLast30d: money,
      },
      refunds: {
        byStatus: {
          pending: 0,
          awaiting_signature: 0,
          submitted: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
        },
        completed: money,
      },
      subscriptions: {
        total: 0,
        byStatus: { trialing: 0, active: 0, at_risk: 0, paused: 0, cancelled: 0, lapsed: 0 },
      },
      customers: { total: 0 },
    }
    expect(statsSummarySchema.safeParse(summary).success).toBe(true)
    const { void: _void, ...missingVoid } = summary.invoices.byStatus
    expect(
      statsSummarySchema.safeParse({
        ...summary,
        invoices: { ...summary.invoices, byStatus: missingVoid },
      }).success,
    ).toBe(false)
  })
})

describe('stats queries', () => {
  it('requires an LTV currency', () => {
    expect(statsLtvQuerySchema.safeParse({}).success).toBe(false)
    expect(statsLtvQuerySchema.safeParse({ currency: 'USYC' }).success).toBe(false)
    expect(statsLtvQuerySchema.parse({ currency: 'EURC', limit: '5' })).toEqual({
      currency: 'EURC',
      limit: 5,
    })
  })

  it('bounds the volume range to 366 days', () => {
    expect(
      statsVolumeQuerySchema.safeParse({
        from: '2025-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
      }).success,
    ).toBe(true)
    expect(
      statsVolumeQuerySchema.safeParse({
        from: '2025-01-01T00:00:00.000Z',
        to: '2026-01-03T00:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      statsVolumeQuerySchema.safeParse({
        from: '2026-01-02T00:00:00.000Z',
        to: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})

describe('stats volume range', () => {
  it('defaults to the 30 days before to, and to now', () => {
    const now = Date.parse('2026-10-03T12:00:00.000Z')
    expect(resolveStatsVolumeRange({}, now)).toEqual({
      from: new Date('2026-09-03T12:00:00.000Z'),
      to: new Date('2026-10-03T12:00:00.000Z'),
    })
    expect(statsVolumeQuerySchema.safeParse({ from: '2020-01-01T00:00:00.000Z' }).success).toBe(
      false,
    )
  })
})
