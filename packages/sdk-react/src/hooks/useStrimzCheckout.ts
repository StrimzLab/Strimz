'use client'

import { StrimzCheckoutError } from '../checkout-error.js'
import { checkoutUrl, readCheckoutResult } from '../checkout-message.js'
import { useHostedPopup, type CheckoutMode, type HostedPopupStatus } from './useHostedPopup.js'

export type { CheckoutMode }

export interface UseStrimzCheckoutOptions {
  /** How to open the hosted checkout. Default `popup`. */
  mode?: CheckoutMode
  /** Called when the checkout reports a successful payment. */
  onSuccess?: (txHash?: string) => void
  /** Called when the payer closes the checkout without completing. */
  onCancel?: () => void
  /** Called on any error reported by the checkout. */
  onError?: (error: Error) => void
}

export interface UseStrimzCheckoutResult {
  open: (sessionId: string) => void
  close: () => void
  status: HostedPopupStatus
}

/**
 * Imperative checkout opener. Lower-level than `<StrimzPayButton/>`.
 *
 *   const checkout = useStrimzCheckout({ onSuccess: ... })
 *   <button onClick={() => checkout.open(sessionId)}>Pay</button>
 */
export function useStrimzCheckout(options: UseStrimzCheckoutOptions = {}): UseStrimzCheckoutResult {
  return useHostedPopup({
    url: checkoutUrl,
    read: (ev, expected) => readCheckoutResult(ev, { ...expected, sessionId: expected.id }),
    mode: options.mode,
    onClosed: options.onCancel,
    onMessage: (data) => {
      switch (data.type) {
        case 'strimz:checkout:success':
          options.onSuccess?.(data.txHash)
          return 'success'
        case 'strimz:checkout:cancel':
          options.onCancel?.()
          return 'cancelled'
        case 'strimz:checkout:error':
          options.onError?.(new StrimzCheckoutError(data.code, data.sessionId, data.message))
          return 'error'
      }
    },
  })
}
