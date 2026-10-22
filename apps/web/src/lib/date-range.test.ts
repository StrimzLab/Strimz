import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { rangeFileName, resolveDateRange, timeZoneName } from './date-range'

const ORIGINAL_TZ = process.env.TZ

beforeAll(() => {
  process.env.TZ = 'Europe/London'
})

afterAll(() => {
  process.env.TZ = ORIGINAL_TZ
})

const at = (local: string) => new Date(local)
const pick = (
  preset: Parameters<typeof resolveDateRange>[0]['preset'],
  fromDay = '',
  toDay = '',
) => ({
  preset,
  fromDay,
  toDay,
})

describe('resolveDateRange', () => {
  it('sends nothing for any time', () => {
    expect(resolveDateRange(pick('any'), at('2026-10-22T15:30:00'))).toEqual({ ok: true })
  })

  it('covers today and the 6 days before it for last 7 days', () => {
    expect(resolveDateRange(pick('last_7_days'), at('2026-10-22T15:30:00'))).toEqual({
      ok: true,
      from: '2026-10-16T00:00:00+01:00',
      to: '2026-10-23T00:00:00+01:00',
      firstDay: '2026-10-16',
      lastDay: '2026-10-22',
    })
  })

  it('runs this month from the 1st to the start of tomorrow', () => {
    expect(resolveDateRange(pick('this_month'), at('2026-10-01T09:00:00'))).toEqual({
      ok: true,
      from: '2026-10-01T00:00:00+01:00',
      to: '2026-10-02T00:00:00+01:00',
      firstDay: '2026-10-01',
      lastDay: '2026-10-01',
    })
  })

  it('takes last month as the whole previous month, across a year', () => {
    expect(resolveDateRange(pick('last_month'), at('2026-01-15T12:00:00'))).toEqual({
      ok: true,
      from: '2025-12-01T00:00:00Z',
      to: '2026-01-01T00:00:00Z',
      firstDay: '2025-12-01',
      lastDay: '2025-12-31',
    })
  })

  it('keeps local midnight on both sides of a clock change', () => {
    expect(resolveDateRange(pick('last_7_days'), at('2026-10-27T10:00:00'))).toMatchObject({
      from: '2026-10-21T00:00:00+01:00',
      to: '2026-10-28T00:00:00Z',
    })
  })

  it('includes the last custom day by sending the next midnight as to', () => {
    expect(
      resolveDateRange(pick('custom', '2026-10-01', '2026-10-31'), at('2026-11-05T10:00:00')),
    ).toEqual({
      ok: true,
      from: '2026-10-01T00:00:00+01:00',
      to: '2026-11-01T00:00:00Z',
      firstDay: '2026-10-01',
      lastDay: '2026-10-31',
    })
  })

  it('allows a custom range with only one side', () => {
    const now = at('2026-11-05T10:00:00')
    expect(resolveDateRange(pick('custom', '2026-10-01'), now)).toEqual({
      ok: true,
      from: '2026-10-01T00:00:00+01:00',
      firstDay: '2026-10-01',
    })
    expect(resolveDateRange(pick('custom', '', '2026-10-31'), now)).toEqual({
      ok: true,
      to: '2026-11-01T00:00:00Z',
      lastDay: '2026-10-31',
    })
  })

  it('accepts a single custom day', () => {
    expect(
      resolveDateRange(pick('custom', '2026-10-05', '2026-10-05'), at('2026-11-05T10:00:00')),
    ).toMatchObject({
      ok: true,
      from: '2026-10-05T00:00:00+01:00',
      to: '2026-10-06T00:00:00+01:00',
    })
  })

  it('refuses a custom range that starts after it ends', () => {
    expect(
      resolveDateRange(pick('custom', '2026-10-31', '2026-10-01'), at('2026-11-05T10:00:00')),
    ).toEqual({ ok: false, error: 'From must be on or before To' })
  })
})

describe('rangeFileName', () => {
  it('names the export after the range', () => {
    expect(rangeFileName('transactions', { ok: true })).toBe('transactions.csv')
    expect(
      rangeFileName('transactions', { ok: true, firstDay: '2026-10-01', lastDay: '2026-10-31' }),
    ).toBe('transactions-2026-10-01-to-2026-10-31.csv')
    expect(rangeFileName('transactions', { ok: true, firstDay: '2026-10-01' })).toBe(
      'transactions-from-2026-10-01.csv',
    )
    expect(rangeFileName('transactions', { ok: true, lastDay: '2026-10-31' })).toBe(
      'transactions-to-2026-10-31.csv',
    )
  })
})

describe('timeZoneName', () => {
  it('reads the browser time zone', () => {
    expect(timeZoneName()).toBe('Europe/London')
  })
})
