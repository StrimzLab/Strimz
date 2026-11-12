'use client'

import * as React from 'react'
import { ChevronDown, PlusCircle, X } from 'lucide-react'
import { PopoverTrigger, cn } from '@strimz/ui'

export function FilterButton({
  label,
  summary,
  onClear,
}: {
  label: string
  /** What's chosen, e.g. "confirmed, pending". Empty when the filter is off. */
  summary: string
  onClear: () => void
}) {
  const active = summary !== ''
  return (
    <div
      className={cn(
        'inline-flex h-9 items-stretch overflow-hidden rounded-md border text-xs font-medium transition-colors',
        active
          ? 'border-accent/40 bg-accent/5 text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground border-dashed',
      )}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/60 focus-visible:ring-ring inline-flex items-center gap-1.5 px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          {active ? null : <PlusCircle className="size-3.5" aria-hidden />}
          <span>{label}</span>
          {active ? (
            <>
              <span className="bg-border h-3.5 w-px" aria-hidden />
              <span className="text-accent max-w-[14rem] truncate">{summary}</span>
            </>
          ) : null}
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      {active ? (
        <button
          type="button"
          aria-label={`Clear ${label} filter`}
          onClick={onClear}
          className="border-accent/30 hover:bg-muted/60 focus-visible:ring-ring inline-flex items-center border-l px-2 outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
