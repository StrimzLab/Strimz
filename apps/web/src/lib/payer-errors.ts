export const PAYER_MESSAGES: Readonly<Record<string, string>> = {
  insufficient_balance:
    'There is not enough of this token in your wallet to cover the first charge. Add funds and try again.',
  amount_below_minimum:
    'This checkout is below the 1.00 minimum Strimz can process. Ask the merchant for a new link.',
  relay_budget_exhausted:
    'This merchant cannot take more checkouts today. Please try again after 00:00 UTC.',
  rate_limited: 'Too many attempts from your network. Wait a minute and try again.',
  subscription_exists: 'This wallet already subscribes to this plan.',
}

export const PAYER_REFUSALS: Readonly<Record<string, string>> = {
  payer_already_bound:
    'This checkout is linked to another wallet. Reconnect it, or ask the merchant for a new link.',
  session_not_open: 'This checkout is no longer open. Ask the merchant for a new link.',
  plan_not_active: 'This plan is no longer offered. Ask the merchant for a new link.',
}

const KNOWN = new Set([...Object.values(PAYER_MESSAGES), ...Object.values(PAYER_REFUSALS)])

export interface PayerError {
  title: string
  detail: string
  action: 'retry' | 'refresh' | null
}

export interface PayerErrorInput {
  raw: string | null
  phase: 'failed' | 'reverted' | 'load_error'
  /** True once the signed payment reached Strimz, so it may still land. */
  submitted: boolean
  merchantName?: string | null
}

const WALLET_REJECTION = /user (rejected|denied|cancel)|rejected the request|request rejected/iu

export function payerError({ raw, phase, submitted, merchantName }: PayerErrorInput): PayerError {
  const merchant = merchantName || 'the merchant'
  if (phase === 'reverted') {
    return {
      title: "The payment didn't go through",
      detail: `Nothing was charged. Try again, or contact ${merchant} if it keeps happening.`,
      action: 'retry',
    }
  }
  if (raw && WALLET_REJECTION.test(raw)) {
    return {
      title: 'You cancelled in your wallet',
      detail: 'Nothing was charged.',
      action: 'retry',
    }
  }
  if (raw && KNOWN.has(raw)) {
    return { title: "The payment didn't go through", detail: raw, action: 'retry' }
  }
  if (raw && /timed out/iu.test(raw)) {
    return {
      title: 'This is taking longer than usual',
      detail: "Don't pay again. We'll email your receipt when the payment lands.",
      action: 'refresh',
    }
  }
  if (submitted) {
    return {
      title: "We couldn't confirm your payment yet",
      detail: `Don't pay again. Refresh this page to check, or contact ${merchant}.`,
      action: 'refresh',
    }
  }
  if (phase === 'load_error') {
    return {
      title: "This checkout isn't available right now",
      detail: `Nothing was charged. Refresh to try again, or ask ${merchant} for a new link.`,
      action: 'refresh',
    }
  }
  return {
    title: "This checkout isn't available right now",
    detail: `Nothing was charged. Try again, or contact ${merchant} if it keeps happening.`,
    action: 'retry',
  }
}

export function attachError(raw: string): string {
  return KNOWN.has(raw) ? raw : "We couldn't save your email. Try again."
}

const STOREFRONT_REFUSALS: Readonly<Record<string, string>> = {
  sold_out: 'This product just sold out.',
  not_found: 'This product is no longer available.',
}

export function storefrontCheckoutError(code: string | null): string {
  return (code && STOREFRONT_REFUSALS[code]) || "We couldn't open checkout. Try again."
}
