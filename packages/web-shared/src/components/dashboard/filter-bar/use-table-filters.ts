'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  emptyFilters,
  hasActiveFilters,
  readFilters,
  writeFilters,
  type FilterSpec,
  type FilterState,
} from '../../../lib/table-filters'

export function useTableFilters<S extends FilterSpec>(spec: S) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()

  const state = React.useMemo(() => readFilters(spec, new URLSearchParams(query)), [spec, query])

  const replace = React.useCallback(
    (next: FilterState<S>) => {
      const params = writeFilters(spec, next, new URLSearchParams(query)).toString()
      router.replace(params ? `${pathname}?${params}` : pathname, { scroll: false })
    },
    [spec, query, pathname, router],
  )

  const set = React.useCallback(
    <K extends keyof S>(key: K, value: FilterState<S>[K]) => replace({ ...state, [key]: value }),
    [replace, state],
  )

  const clear = React.useCallback(() => replace(emptyFilters(spec)), [replace, spec])

  return { state, set, clear, active: hasActiveFilters(spec, state) }
}
