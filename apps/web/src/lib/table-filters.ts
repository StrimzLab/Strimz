import { isValid, parse } from 'date-fns'

import { DATE_PRESETS, type DatePreset, type DateSelection } from '@/lib/date-range'

export interface MultiFilter<V extends string> {
  type: 'multi'
  values: readonly V[]
}

export interface DateFilterSpec {
  type: 'date'
}

export type FilterSpec = Record<string, MultiFilter<string> | DateFilterSpec>

export type FilterState<S extends FilterSpec> = {
  [K in keyof S]: S[K] extends MultiFilter<infer V> ? readonly V[] : DateSelection
}

export const multiFilter = <V extends string>(values: readonly V[]): MultiFilter<V> => ({
  type: 'multi',
  values,
})

export const dateFilter = (): DateFilterSpec => ({ type: 'date' })

export const NO_DATES: DateSelection = { preset: 'any', fromDay: '', toDay: '' }

// A custom range lives in the URL as `from` and `to` calendar days.
const FROM = 'from'
const TO = 'to'

const isDay = (v: string | null): v is string =>
  v !== null && /^\d{4}-\d{2}-\d{2}$/u.test(v) && isValid(parse(v, 'yyyy-MM-dd', new Date()))

export function emptyFilters<S extends FilterSpec>(spec: S): FilterState<S> {
  const state: Record<string, unknown> = {}
  for (const [key, filter] of Object.entries(spec)) {
    state[key] = filter.type === 'multi' ? [] : NO_DATES
  }
  return state as FilterState<S>
}

export function readFilters<S extends FilterSpec>(
  spec: S,
  params: URLSearchParams,
): FilterState<S> {
  const state: Record<string, unknown> = {}
  for (const [key, filter] of Object.entries(spec)) {
    if (filter.type === 'multi') {
      const picked = new Set((params.get(key) ?? '').split(','))
      state[key] = filter.values.filter((v) => picked.has(v))
    } else {
      const preset = params.get(key)
      if (!preset || !(DATE_PRESETS as readonly string[]).includes(preset)) {
        state[key] = NO_DATES
        continue
      }
      const from = params.get(FROM)
      const to = params.get(TO)
      state[key] = {
        preset: preset as DatePreset,
        fromDay: preset === 'custom' && isDay(from) ? from : '',
        toDay: preset === 'custom' && isDay(to) ? to : '',
      }
    }
  }
  return state as FilterState<S>
}

export function writeFilters<S extends FilterSpec>(
  spec: S,
  state: FilterState<S>,
  current: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, filter] of Object.entries(spec)) {
    const value = state[key as keyof S]
    if (filter.type === 'multi') {
      const values = value as readonly string[]
      if (values.length > 0) next.set(key, values.join(','))
      else next.delete(key)
    } else {
      const dates = value as DateSelection
      next.delete(FROM)
      next.delete(TO)
      if (dates.preset === 'any') {
        next.delete(key)
        continue
      }
      next.set(key, dates.preset)
      if (dates.preset === 'custom') {
        if (dates.fromDay) next.set(FROM, dates.fromDay)
        if (dates.toDay) next.set(TO, dates.toDay)
      }
    }
  }
  return next
}

export function hasActiveFilters<S extends FilterSpec>(spec: S, state: FilterState<S>): boolean {
  return Object.entries(spec).some(([key, filter]) => {
    const value = state[key as keyof S]
    return filter.type === 'multi'
      ? (value as readonly string[]).length > 0
      : (value as DateSelection).preset !== 'any'
  })
}
