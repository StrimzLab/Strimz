import type { SubscriptionPlan } from '@strimz/shared-types'

export type CheckoutFlow = 'pay' | 'subscribe'

export const STEP_LABELS = ['Approve', 'Processing'] as const

export function phaseLine(phase: string, flow: CheckoutFlow): string {
  switch (phase) {
    case 'loading':
      return flow === 'pay' ? 'Loading your checkout…' : 'Loading the plan…'
    case 'connect':
      return "Connect the wallet you'll pay from."
    case 'ready':
      return flow === 'pay'
        ? 'You approve once in your wallet. No extra fee for you.'
        : 'You approve once in your wallet. Each charge after that is automatic.'
    case 'signing':
      return flow === 'pay'
        ? 'Check your wallet and approve the payment.'
        : 'Check your wallet and approve the subscription.'
    case 'submitting':
    case 'polling':
      return flow === 'pay' ? 'Processing your payment…' : 'Setting up your subscription…'
    default:
      return ''
  }
}

export function busyLabel(phase: 'loading' | 'signing' | 'submitting' | 'polling'): string {
  switch (phase) {
    case 'loading':
      return 'Loading…'
    case 'signing':
      return 'Waiting for your approval…'
    case 'submitting':
      return 'Processing…'
    case 'polling':
      return 'Almost done…'
  }
}

export const HOW_IT_WORKS: Record<CheckoutFlow, readonly string[]> = {
  pay: ['Connect your wallet.', 'Approve once.', 'The merchant is paid straight away.'],
  subscribe: [
    'Connect your wallet.',
    'Approve once.',
    'Each charge then happens automatically on schedule.',
  ],
}

export function networkNote(symbol: string): string {
  return `Paid in ${symbol} on the Arc network.`
}

export function intervalLabel(interval: SubscriptionPlan['interval'] | null | undefined): string {
  switch (interval) {
    case 'daily':
      return 'day'
    case 'weekly':
      return 'week'
    case 'monthly':
      return 'month'
    case 'quarterly':
      return 'quarter'
    case 'yearly':
      return 'year'
    default:
      return 'period'
  }
}
