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
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
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

export function StepIndicator({
  step,
}: {
  step: 'connect' | 'approve' | 'pay' | 'confirmed'
}) {
  const items = [
    { id: 'approve', label: 'Approve' },
    { id: 'pay', label: 'Pay' },
  ] as const
  const activeIndex = step === 'approve' ? 0 : step === 'pay' || step === 'confirmed' ? 1 : -1

  return (
    <div className="flex items-center gap-3">
      {items.map((item, i) => {
        const isActive = activeIndex === i
        const isDone = activeIndex > i || step === 'confirmed'
        return (
          <div key={item.id} className="flex flex-1 items-center gap-3">
            <div
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                isDone
                  ? 'bg-[#02C76A]/15 text-[#02C76A]'
                  : isActive
                  ? 'bg-[#02C76A] text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {isDone ? '✓' : i + 1}
            </div>
            <span className="text-sm text-muted-foreground">{item.label}</span>
            {i < items.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        )
      })}
    </div>
  )
}
