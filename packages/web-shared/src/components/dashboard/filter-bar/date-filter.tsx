'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { FieldLabel, Input, Popover, PopoverContent } from '@strimz/ui'

import {
  DATE_PRESETS,
  timeZoneName,
  type DatePreset,
  type DateSelection,
} from '../../../lib/date-range'
import { NO_DATES } from '../../../lib/table-filters'

import { FilterButton } from './filter-button'

const PRESET_LABEL: Record<DatePreset, string> = {
  any: 'Any time',
  today: 'Today',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom',
}

function customSummary({ fromDay, toDay }: DateSelection): string {
  if (fromDay && toDay) return `${fromDay} – ${toDay}`
  if (fromDay) return `From ${fromDay}`
  if (toDay) return `Until ${toDay}`
  return 'Custom'
}

export function DateFilter({
  label = 'Date',
  value,
  error,
  onChange,
}: {
  label?: string
  value: DateSelection
  /** Shown when a custom range ends before it starts. */
  error: string | null
  onChange: (next: DateSelection) => void
}) {
  const id = React.useId()
  const summary =
    value.preset === 'any'
      ? ''
      : value.preset === 'custom'
        ? customSummary(value)
        : PRESET_LABEL[value.preset]

  return (
    <Popover>
      <FilterButton
        label={label}
        summary={summary}
        onClear={value.preset === 'any' ? undefined : () => onChange(NO_DATES)}
      />
      <PopoverContent className="w-72">
        <div role="group" aria-label={label} className="space-y-0.5">
          {DATE_PRESETS.map((preset) => {
            const on = value.preset === preset
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...value, preset })}
                className="font-poppins text-foreground hover:bg-muted focus-visible:bg-muted flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm outline-none"
              >
                {PRESET_LABEL[preset]}
                {on ? <Check className="text-accent size-4" aria-hidden /> : null}
              </button>
            )
          })}
        </div>
        {value.preset === 'custom' ? (
          <div className="border-border mt-1 space-y-2 border-t px-2.5 pb-1.5 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <FieldLabel htmlFor={`${id}-from`} required={false}>
                  From
                </FieldLabel>
                <Input
                  id={`${id}-from`}
                  type="date"
                  value={value.fromDay}
                  max={value.toDay || undefined}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${id}-note`}
                  onChange={(e) => onChange({ ...value, fromDay: e.target.value })}
                  className="h-9 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor={`${id}-to`} required={false}>
                  To
                </FieldLabel>
                <Input
                  id={`${id}-to`}
                  type="date"
                  value={value.toDay}
                  min={value.fromDay || undefined}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`${id}-note`}
                  onChange={(e) => onChange({ ...value, toDay: e.target.value })}
                  className="h-9 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>
            {error ? (
              <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                {error}
              </p>
            ) : null}
            <p id={`${id}-note`} className="text-muted-foreground text-xs">
              Both days are included. Dates are in your time zone ({timeZoneName()}).
            </p>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
