'use client'

import { cn } from '@strimz/ui'

import { useDashboardMode } from '@strimz/web-shared/lib/dashboard-mode'

// Read-only badge: "Test" on Arc testnet, "Live" on mainnet, from NEXT_PUBLIC_ARC_ENVIRONMENT.
export function ModeToggle() {
  const mode = useDashboardMode()
  return (
    <span
      className={cn(
        'border-border/60 bg-card inline-flex h-9 items-center rounded-md border px-2.5 text-xs font-medium',
        mode === 'live' ? 'text-foreground' : 'text-brand-text',
      )}
      aria-label={`Dashboard mode: ${mode === 'live' ? 'Live' : 'Test'}`}
    >
      {mode === 'live' ? 'Live' : 'Test'}
    </span>
  )
}
