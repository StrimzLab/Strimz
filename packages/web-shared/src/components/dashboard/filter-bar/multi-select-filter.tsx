'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { Popover, PopoverContent, cn } from '@strimz/ui'

import { TONE_DOT, type StatusTone } from '../data-table'

import { FilterButton } from './filter-button'

export interface FilterOption<V extends string> {
  value: V
  label: string
  tone?: StatusTone
}

export function MultiSelectFilter<V extends string>({
  label,
  options,
  selected,
  initial = [],
  onChange,
}: {
  label: string
  options: readonly FilterOption<V>[]
  selected: readonly V[]
  /** What the filter falls back to when cleared. */
  initial?: readonly V[]
  onChange: (next: V[]) => void
}) {
  const chosen = options.filter((o) => selected.includes(o.value))
  const changed = selected.length !== initial.length || selected.some((v) => !initial.includes(v))
  const summary =
    chosen.length === 0
      ? initial.length > 0
        ? 'All'
        : ''
      : chosen.length <= 2
        ? chosen.map((o) => o.label).join(', ')
        : `${chosen.length} selected`
  const reset = () => onChange([...initial])

  const toggle = (value: V) =>
    onChange(
      options
        .map((o) => o.value)
        .filter((v) => (v === value ? !selected.includes(v) : selected.includes(v))),
    )

  return (
    <Popover>
      <FilterButton label={label} summary={summary} onClear={changed ? reset : undefined} />
      <PopoverContent className="w-60">
        <div role="group" aria-label={label} className="max-h-72 space-y-0.5 overflow-y-auto">
          {options.map((option) => {
            const on = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(option.value)}
                className="font-poppins text-foreground hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-none"
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-[4px] border',
                    on ? 'border-accent bg-accent text-white' : 'border-border',
                  )}
                  aria-hidden
                >
                  {on ? <Check className="size-3" /> : null}
                </span>
                {option.tone ? (
                  <span className={cn('size-2 rounded-full', TONE_DOT[option.tone])} aria-hidden />
                ) : null}
                <span className="truncate">{option.label}</span>
              </button>
            )
          })}
        </div>
        {changed ? (
          <>
            <div className="bg-border my-1 h-px" />
            <button
              type="button"
              onClick={reset}
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:bg-muted w-full rounded-md px-2.5 py-2 text-left text-sm outline-none"
            >
              Clear
            </button>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

export function filterOptions<V extends string>(
  values: readonly V[],
  tones?: Partial<Record<V, StatusTone>>,
  label: (value: V) => string = (v) => v.replace(/_/g, ' '),
): FilterOption<V>[] {
  return values.map((value) => ({ value, label: label(value), tone: tones?.[value] }))
}
