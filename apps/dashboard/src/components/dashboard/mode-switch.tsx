'use client'

import { cn } from '@strimz/ui'
import { useDashboardModeSwitch, type DashboardMode } from '@strimz/web-shared/lib/dashboard-mode'

const LABELS: Record<DashboardMode, string> = { test: 'Test', live: 'Live' }

/** Test / Live switch (ADR-2026-11-26-test-mode). Hidden when the build has one mode. */
export function ModeSwitch() {
  const control = useDashboardModeSwitch()
  if (!control || control.modes.length < 2) return null
  return (
    <div
      role="group"
      aria-label="Mode"
      className="border-border/60 bg-card flex h-9 items-center gap-0.5 rounded-md border p-0.5"
    >
      {control.modes.map((mode) => {
        const active = control.mode === mode
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            onClick={() => control.setMode(mode)}
            className={cn(
              'h-7 rounded px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1',
              active
                ? mode === 'test'
                  ? 'bg-warning-surface text-warning'
                  : 'bg-accent/15 text-brand-text'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {LABELS[mode]}
          </button>
        )
      })}
    </div>
  )
}
