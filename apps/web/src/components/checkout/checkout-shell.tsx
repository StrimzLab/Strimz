'use client'

import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { PaymentSummary, CheckoutPoweredBy, type SummaryProps } from './payment-summary'

/**
 * Two-column checkout shell. Summary on the left (frozen),
 * step machine on the right.
 */
export function CheckoutShell({
  summary,
  children,
  onCancel,
}: {
  summary: SummaryProps
  children: ReactNode
  onCancel?: () => void
}) {
  return (
    <section className="flex w-full flex-col gap-4 p-4 md:p-8">
      <div>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Cancel
        </button>
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <PaymentSummary {...summary} />
        </div>
        <div className="flex items-center justify-center lg:col-span-3 lg:p-8">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      <CheckoutPoweredBy />
    </section>
  )
}

/**
 * Two-step indicator: `Sign` then `Settle`.
 *
 * The flow has collapsed from the legacy four-stage (connect →
 * approve → pay → confirmed) to a single payer-facing action: sign
 * once, Strimz settles. The first dot fills while the wallet prompt
 * is up; the second fills while the relay submits + confirms. The
 * connect step is handled by the page (button appears before the
 * indicator renders) so it's not represented here.
 */
export type CheckoutPhase =
  | 'connect'
  | 'ready'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

export function StepIndicator({ phase }: { phase: CheckoutPhase }) {
  const items = [
    { id: 'sign', label: 'Sign' },
    { id: 'settle', label: 'Settle' },
  ] as const
  const activeIndex = activeIndexForPhase(phase)
  const isTerminal = phase === 'confirmed' || phase === 'reverted' || phase === 'failed'

  return (
    <div className="flex items-center gap-3">
      {items.map((item, i) => {
        const isActive = activeIndex === i
        const isDone = activeIndex > i || (phase === 'confirmed' && i === items.length - 1)
        return (
          <div key={item.id} className="flex flex-1 items-center gap-3">
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                isDone
                  ? 'bg-[#02C76A]/15 text-[#02C76A]'
                  : isActive && !isTerminal
                    ? 'bg-[#02C76A] text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {isDone ? '✓' : i + 1}
            </div>
            <span className="text-muted-foreground text-sm">{item.label}</span>
            {i < items.length - 1 && <div className="bg-border h-px flex-1" />}
          </div>
        )
      })}
    </div>
  )
}

function activeIndexForPhase(phase: CheckoutPhase): number {
  // `Sign` is index 0; `Settle` is index 1. `connect`/`ready` mean
  // we're before the indicator should show, but if a page does render
  // it during `ready` we still light up Sign as the next action.
  switch (phase) {
    case 'ready':
    case 'signing':
      return 0
    case 'submitting':
    case 'polling':
    case 'reverted':
    case 'failed':
      return 1
    case 'confirmed':
      return 1
    case 'connect':
    default:
      return -1
  }
}
