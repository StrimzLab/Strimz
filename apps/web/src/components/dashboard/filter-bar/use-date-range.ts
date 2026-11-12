'use client'

import * as React from 'react'

import { resolveDateRange, type DateSelection, type ValidRange } from '@/lib/date-range'

// While a custom range is invalid, the table keeps showing the last valid one.
export function useDateRange(selection: DateSelection) {
  const resolved = React.useMemo(() => resolveDateRange(selection, new Date()), [selection])
  const [range, setRange] = React.useState<ValidRange>(resolved.ok ? resolved : { ok: true })
  if (resolved.ok && resolved !== range) setRange(resolved)
  return { range, error: resolved.ok ? null : resolved.error }
}
