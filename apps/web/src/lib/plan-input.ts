import { MINIMUM_PAYMENT_AMOUNT } from '@strimz/shared-config'
import {
  callbackUrlSchema,
  type CreateSubscriptionPlanInput,
  type PaymentCurrency,
  type SubscriptionInterval,
  type UpdateSubscriptionPlanInput,
} from '@strimz/shared-types'

import { formatTokenAmount } from '@/lib/format'
import { parseTokenAmountInput } from '@/lib/token-amount-input'

export type PlanInputResult =
  | { ok: true; input: CreateSubscriptionPlanInput }
  | { ok: false; error: string }

export type ReturnUrlsInputResult =
  | { ok: true; input: UpdateSubscriptionPlanInput }
  | { ok: false; error: string }

const WHOLE = /^\d+$/u

function wholeInRange(text: string, min: number, max: number): number | null {
  if (!WHOLE.test(text)) return null
  const value = Number(text)
  return value >= min && value <= max ? value : null
}

export function buildPlanInput(args: {
  name: string
  description: string
  amount: string
  currency: PaymentCurrency
  interval: SubscriptionInterval
  intervalCount: string
  trialDays: string
  successUrl: string
  cancelUrl: string
}): PlanInputResult {
  const name = args.name.trim()
  if (!name) return { ok: false, error: 'Enter a plan name' }
  if (name.length > 120) return { ok: false, error: 'Plan name must be 120 characters or fewer' }

  const description = args.description.trim()
  if (description.length > 500) {
    return { ok: false, error: 'Description must be 500 characters or fewer' }
  }

  const parsed = parseTokenAmountInput(args.amount, args.currency, 'Enter a price')
  if (!parsed.ok) return parsed
  if (parsed.amount < MINIMUM_PAYMENT_AMOUNT) {
    return {
      ok: false,
      error: `Enter at least ${formatTokenAmount(MINIMUM_PAYMENT_AMOUNT.toString(), args.currency)}`,
    }
  }

  const countText = args.intervalCount.trim()
  const intervalCount = countText === '' ? 1 : wholeInRange(countText, 1, 365)
  if (intervalCount === null) {
    return { ok: false, error: 'Bill every must be a whole number from 1 to 365' }
  }

  const trialText = args.trialDays.trim()
  const trialDays = trialText === '' ? 0 : wholeInRange(trialText, 0, 365)
  if (trialDays === null) {
    return { ok: false, error: 'Trial must be a whole number of days from 0 to 365' }
  }

  const urls = readReturnUrls(args)
  if (!urls.ok) return urls

  return {
    ok: true,
    input: {
      name,
      ...(description ? { description } : {}),
      amount: parsed.amount.toString(),
      currency: args.currency,
      interval: args.interval,
      intervalCount,
      ...(trialDays > 0 ? { trialPeriodDays: trialDays } : {}),
      ...(urls.successUrl ? { successUrl: urls.successUrl } : {}),
      ...(urls.cancelUrl ? { cancelUrl: urls.cancelUrl } : {}),
    },
  }
}

/** For editing: a blank field becomes null, which clears it. */
export function buildReturnUrlsInput(args: {
  successUrl: string
  cancelUrl: string
}): ReturnUrlsInputResult {
  const urls = readReturnUrls(args)
  if (!urls.ok) return urls
  return { ok: true, input: { successUrl: urls.successUrl, cancelUrl: urls.cancelUrl } }
}

function readReturnUrls(args: {
  successUrl: string
  cancelUrl: string
}):
  | { ok: true; successUrl: string | null; cancelUrl: string | null }
  | { ok: false; error: string } {
  const successUrl = args.successUrl.trim() || null
  const cancelUrl = args.cancelUrl.trim() || null
  if (successUrl && !callbackUrlSchema.safeParse(successUrl).success) {
    return { ok: false, error: 'Success URL must start with https:// or http://' }
  }
  if (cancelUrl && !callbackUrlSchema.safeParse(cancelUrl).success) {
    return { ok: false, error: 'Cancel URL must start with https:// or http://' }
  }
  return { ok: true, successUrl, cancelUrl }
}
