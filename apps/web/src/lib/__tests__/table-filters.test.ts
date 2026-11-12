import { describe, expect, it } from 'vitest'

import {
  dateFilter,
  emptyFilters,
  hasActiveFilters,
  multiFilter,
  readFilters,
  writeFilters,
} from '@/lib/table-filters'

const spec = {
  status: multiFilter(['confirmed', 'pending', 'failed'] as const),
  kind: multiFilter(['one_shot', 'refund'] as const),
  date: dateFilter(),
}

const params = (query: string) => new URLSearchParams(query)

describe('readFilters', () => {
  it('reads nothing as no filters', () => {
    expect(readFilters(spec, params(''))).toEqual(emptyFilters(spec))
  })

  it('reads comma lists in the order of the spec', () => {
    const state = readFilters(spec, params('status=failed,confirmed&kind=refund'))
    expect(state.status).toEqual(['confirmed', 'failed'])
    expect(state.kind).toEqual(['refund'])
  })

  it('drops values the spec does not know', () => {
    expect(readFilters(spec, params('status=confirmed,paid,,%3Cx%3E')).status).toEqual([
      'confirmed',
    ])
  })

  it('reads a date preset', () => {
    expect(readFilters(spec, params('date=last_7_days')).date).toEqual({
      preset: 'last_7_days',
      fromDay: '',
      toDay: '',
    })
  })

  it('reads a custom range with its days', () => {
    expect(readFilters(spec, params('date=custom&from=2026-10-01&to=2026-10-31')).date).toEqual({
      preset: 'custom',
      fromDay: '2026-10-01',
      toDay: '2026-10-31',
    })
  })

  it('ignores a date preset or day it does not know', () => {
    expect(readFilters(spec, params('date=forever')).date.preset).toBe('any')
    expect(readFilters(spec, params('date=custom&from=yesterday')).date.fromDay).toBe('')
  })
})

describe('writeFilters', () => {
  it('writes lists and the date, and keeps unrelated params', () => {
    const next = writeFilters(
      spec,
      {
        status: ['confirmed', 'pending'],
        kind: [],
        date: { preset: 'custom', fromDay: '2026-10-01', toDay: '' },
      },
      params('new=1&status=failed'),
    )
    expect(next.get('status')).toBe('confirmed,pending')
    expect(next.has('kind')).toBe(false)
    expect(next.get('date')).toBe('custom')
    expect(next.get('from')).toBe('2026-10-01')
    expect(next.has('to')).toBe(false)
    expect(next.get('new')).toBe('1')
  })

  it('drops the days when the preset is not custom', () => {
    const next = writeFilters(
      spec,
      { ...emptyFilters(spec), date: { preset: 'this_month', fromDay: '2026-10-01', toDay: '' } },
      params('from=2026-10-01'),
    )
    expect(next.get('date')).toBe('this_month')
    expect(next.has('from')).toBe(false)
  })

  it('round-trips through readFilters', () => {
    const state = {
      status: ['pending'] as const,
      kind: ['one_shot', 'refund'] as const,
      date: { preset: 'last_month' as const, fromDay: '', toDay: '' },
    }
    const written = writeFilters(spec, state, params(''))
    expect(readFilters(spec, written)).toEqual(state)
  })
})

describe('hasActiveFilters', () => {
  it('is false with nothing chosen', () => {
    expect(hasActiveFilters(spec, emptyFilters(spec))).toBe(false)
  })

  it('is true with a value or a date', () => {
    expect(hasActiveFilters(spec, { ...emptyFilters(spec), kind: ['refund'] })).toBe(true)
    expect(
      hasActiveFilters(spec, {
        ...emptyFilters(spec),
        date: { preset: 'today', fromDay: '', toDay: '' },
      }),
    ).toBe(true)
  })
})

describe('a filter with a default', () => {
  const planSpec = { status: multiFilter(['active', 'archived'] as const, ['active']) }

  it('starts on its default when the URL says nothing', () => {
    expect(readFilters(planSpec, params('')).status).toEqual(['active'])
    expect(emptyFilters(planSpec).status).toEqual(['active'])
  })

  it('is not counted as a filter while on its default', () => {
    expect(hasActiveFilters(planSpec, { status: ['active'] })).toBe(false)
    expect(hasActiveFilters(planSpec, { status: ['active', 'archived'] })).toBe(true)
  })

  it('keeps the default out of the URL', () => {
    expect(
      writeFilters(planSpec, { status: ['active'] }, params('status=archived')).has('status'),
    ).toBe(false)
  })

  it('remembers that every value was cleared', () => {
    const written = writeFilters(planSpec, { status: [] }, params(''))
    expect(written.get('status')).toBe('')
    expect(readFilters(planSpec, written).status).toEqual([])
  })
})
