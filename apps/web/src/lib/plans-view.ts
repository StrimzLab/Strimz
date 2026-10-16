import type { PaymentCurrency, SubscriptionInterval } from '@strimz/shared-types'

import { formatTokenAmount } from '@/lib/format'

const UNITS: Record<SubscriptionInterval, [singular: string, plural: string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  quarterly: ['quarter', 'quarters'],
  yearly: ['year', 'years'],
}

export function billingLabel(interval: SubscriptionInterval, intervalCount: number): string {
  const [singular, plural] = UNITS[interval]
  return intervalCount === 1 ? `every ${singular}` : `every ${intervalCount} ${plural}`
}

export function planPriceLabel(plan: {
  amount: string
  currency: PaymentCurrency
  interval: SubscriptionInterval
  intervalCount: number
}): string {
  return `${formatTokenAmount(plan.amount, plan.currency)} ${billingLabel(plan.interval, plan.intervalCount)}`
}
