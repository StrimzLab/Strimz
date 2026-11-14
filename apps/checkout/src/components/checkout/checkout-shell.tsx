'use client'

import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { PaymentSummary, CheckoutPoweredBy, type SummaryProps } from './payment-summary'
import { CancelledPanel } from './cancelled-panel'
import { STEP_LABELS, type CheckoutFlow } from '@/lib/checkout-copy'

/**
 * Two-column checkout shell. Summary on the left (frozen),
 * step machine on the right.
 */
export function CheckoutShell({
  summary,
  children,
  onCancel,
  cancelled = false,
  flow,
}: {
  summary: SummaryProps
  children: ReactNode
  onCancel?: () => void
  cancelled?: boolean
  flow: CheckoutFlow
}) {
  return (
    <section className="flex w-full flex-col gap-4 p-4 md:p-8">
      <div className="min-h-5">
        {onCancel && !cancelled && (
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" />
            Cancel
          </button>
        )}
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <PaymentSummary {...summary} />
        </div>
        <div className="flex items-center justify-center lg:col-span-3 lg:p-8">
          <div className="w-full max-w-md">
            {cancelled ? <CancelledPanel flow={flow} /> : children}
          </div>
        </div>
      </div>

      <CheckoutPoweredBy />
    </section>
  )
}

export type CheckoutPhase =
  | 'connect'
  | 'ready'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

/**
 * Two steps: approve in the wallet, then Strimz processes it. Connect
 * happens before the indicator shows.
 */
export function StepIndicator({ phase }: { phase: CheckoutPhase }) {
  const items = STEP_LABELS
  const activeIndex = activeIndexForPhase(phase)
  const isTerminal = phase === 'confirmed' || phase === 'reverted' || phase === 'failed'

  return (
    <div className="flex items-center gap-3">
      {items.map((item, i) => {
        const isActive = activeIndex === i
        const isDone = activeIndex > i || (phase === 'confirmed' && i === items.length - 1)
        return (
          <div key={item} className="flex flex-1 items-center gap-3">
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                isDone
                  ? 'bg-accent/15 text-accent'
                  : isActive && !isTerminal
                    ? 'bg-accent text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {isDone ? '✓' : i + 1}
            </div>
            <span className="text-muted-foreground text-sm">{item}</span>
            {i < items.length - 1 && <div className="bg-border h-px flex-1" />}
          </div>
        )
      })}
    </div>
  )
}

function activeIndexForPhase(phase: CheckoutPhase): number {
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
