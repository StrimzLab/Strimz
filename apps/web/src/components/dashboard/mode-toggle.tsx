'use client'

import { cn } from '@strimz/ui'

import { useDashboardMode } from '@/lib/dashboard-mode'

/**
 * Stripe-style Test / Live toggle. Persists to localStorage so the
 * choice survives reloads and shares across tabs. Switching triggers
 * a full reload so every TanStack Query invalidates cleanly against
 * the new `x-strimz-mode` header.
 *
 * Live mode is currently locked because Arc mainnet is not deployed.
 * When mainnet ships, drop the `disabled` flag on the Live button.
 */
export function ModeToggle() {
  const mode = useDashboardMode()
  return (
    <span
      className={cn(
        'border-border/60 bg-card inline-flex h-9 items-center rounded-md border px-2.5 text-xs font-medium',
        mode === 'live' ? 'text-foreground' : 'text-accent',
      )}
      aria-label={`Dashboard mode: ${mode === 'live' ? 'Live' : 'Test'}`}
    >
      {mode === 'live' ? 'Live' : 'Test'}
    </span>
  )
}
