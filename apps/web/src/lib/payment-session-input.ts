import { MINIMUM_PAYMENT_AMOUNT } from '@strimz/shared-config'
import type { CreatePaymentSessionInput, PaymentCurrency } from '@strimz/shared-types'
import { z } from 'zod'

import { formatTokenAmount } from '@/lib/format'
import { parseTokenAmountInput } from '@/lib/token-amount-input'

export type PaymentSessionInputResult =
  | { ok: true; input: CreatePaymentSessionInput }
  | { ok: false; error: string }

const DEFAULT_EXPIRY_MINUTES = 30
const MAX_EXPIRY_MINUTES = 1440
const email = z.string().email()

function httpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function buildPaymentSessionInput(args: {
  amount: string
  currency: PaymentCurrency
  description: string
  customerEmail: string
  expiresInMinutes: string
  successUrl: string
  cancelUrl: string
}): PaymentSessionInputResult {
  const parsed = parseTokenAmountInput(args.amount, args.currency, 'Enter an amount')
  if (!parsed.ok) return parsed
  if (parsed.amount < MINIMUM_PAYMENT_AMOUNT) {
    return {
      ok: false,
      error: `Enter at least ${formatTokenAmount(MINIMUM_PAYMENT_AMOUNT.toString(), args.currency)}`,
    }
  }

  const description = args.description.trim()
  if (description.length > 500) {
    return { ok: false, error: 'Description must be 500 characters or fewer' }
  }

  const customerEmail = args.customerEmail.trim()
  if (customerEmail && !email.safeParse(customerEmail).success) {
    return { ok: false, error: 'Enter a valid customer email' }
  }

  const expiryText = args.expiresInMinutes.trim()
  let expiresInMinutes = DEFAULT_EXPIRY_MINUTES
  if (expiryText) {
    const minutes = Number(expiryText)
    if (!/^\d+$/u.test(expiryText) || minutes < 1 || minutes > MAX_EXPIRY_MINUTES) {
      return {
        ok: false,
        error: `Expiry must be a whole number of minutes from 1 to ${MAX_EXPIRY_MINUTES}`,
      }
    }
    expiresInMinutes = minutes
  }

  const successUrl = args.successUrl.trim()
  if (successUrl && !httpUrl(successUrl)) {
    return { ok: false, error: 'Success URL must start with http:// or https://' }
  }
  const cancelUrl = args.cancelUrl.trim()
  if (cancelUrl && !httpUrl(cancelUrl)) {
    return { ok: false, error: 'Cancel URL must start with http:// or https://' }
  }

  return {
    ok: true,
    input: {
      amount: parsed.amount.toString(),
      currency: args.currency,
      ...(description ? { description } : {}),
      ...(customerEmail ? { customer: { email: customerEmail } } : {}),
      expiresInMinutes,
      ...(successUrl ? { successUrl } : {}),
      ...(cancelUrl ? { cancelUrl } : {}),
    },
  }
}
