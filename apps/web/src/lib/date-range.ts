import {
  addDays,
  format,
  formatISO,
  isValid,
  parse,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns'

export type DatePreset = 'any' | 'last_7_days' | 'this_month' | 'last_month' | 'custom'

export interface DateSelection {
  preset: DatePreset
  /** `yyyy-MM-dd` from a date input, or '' when empty. */
  fromDay: string
  toDay: string
}

export interface ValidRange {
  ok: true
  from?: string
  to?: string
  firstDay?: string
  lastDay?: string
}

export type DateRange = ValidRange | { ok: false; error: string }

const DAY = 'yyyy-MM-dd'

// Days are built from local calendar fields, so DST days stay midnight to midnight.
function bounds(first: Date, endExclusive: Date): DateRange {
  return {
    ok: true,
    from: formatISO(first),
    to: formatISO(endExclusive),
    firstDay: format(first, DAY),
    lastDay: format(subDays(endExclusive, 1), DAY),
  }
}

function parseDay(day: string): Date | null {
  if (!day) return null
  const parsed = parse(day, DAY, new Date())
  return isValid(parsed) ? parsed : null
}

export function resolveDateRange(selection: DateSelection, now: Date): DateRange {
  const today = startOfDay(now)
  switch (selection.preset) {
    case 'any':
      return { ok: true }
    case 'last_7_days':
      return bounds(subDays(today, 6), addDays(today, 1))
    case 'this_month':
      return bounds(startOfMonth(today), addDays(today, 1))
    case 'last_month':
      return bounds(startOfMonth(subMonths(today, 1)), startOfMonth(today))
    case 'custom': {
      const first = parseDay(selection.fromDay)
      const last = parseDay(selection.toDay)
      if (first && last && first > last) {
        return { ok: false, error: 'From must be on or before To' }
      }
      const range: ValidRange = { ok: true }
      if (first) {
        range.from = formatISO(first)
        range.firstDay = format(first, DAY)
      }
      if (last) {
        range.to = formatISO(addDays(last, 1))
        range.lastDay = format(last, DAY)
      }
      return range
    }
  }
}

export function rangeFileName(base: string, range: DateRange): string {
  if (!range.ok) return `${base}.csv`
  const { firstDay, lastDay } = range
  if (firstDay && lastDay) return `${base}-${firstDay}-to-${lastDay}.csv`
  if (firstDay) return `${base}-from-${firstDay}.csv`
  if (lastDay) return `${base}-to-${lastDay}.csv`
  return `${base}.csv`
}

export function timeZoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
