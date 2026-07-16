'use client'

import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from '@strimz/ui'

import { getDashboardMode, setDashboardMode, type DashboardMode } from '@/lib/dashboard-mode'

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
  const [mode, setMode] = useState<DashboardMode>('test')

  useEffect(() => {
    setMode(getDashboardMode())
  }, [])

  const switchTo = (next: DashboardMode) => {
    if (next === mode) return
    setDashboardMode(next)
    window.location.reload()
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className="hover:shadow-sub-icon border-border/60 inline-flex h-9 items-center rounded-md border bg-white p-0.5 text-xs font-medium"
        role="group"
        aria-label="Dashboard mode"
      >
        <button
          type="button"
          onClick={() => switchTo('test')}
          className={cn(
            'h-full rounded-[5px] px-2 transition-colors sm:px-2.5',
            mode === 'test'
              ? 'bg-[#02C76A]/12 text-[#02C76A]'
              : 'text-[#58556A] hover:text-[#050020]',
          )}
        >
          Test
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className={cn(
                'inline-flex h-full items-center gap-1 rounded-[5px] px-2 text-[#8B8896] sm:px-2.5',
                'cursor-not-allowed opacity-70',
              )}
            >
              Live
              <Info className="hidden size-3 sm:block" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px] text-xs">
            Mainnet coming soon. Live mode unlocks when Arc Mainnet launches.
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
