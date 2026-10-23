'use client'

import { StrimzSubscriptionError } from '../subscription-error.js'
import { readSubscriptionResult, subscriptionUrl } from '../checkout-message.js'
import { useHostedPopup, type CheckoutMode, type HostedPopupStatus } from './useHostedPopup.js'

export interface StrimzSubscriptionResult {
  /** Null when Strimz hadn't recorded the subscription yet; use the webhook. */
  subscriptionId: string | null
  txHash: string
}

export interface UseStrimzSubscribeOptions {
  /** How to open the plan checkout. Default `popup`. */
  mode?: CheckoutMode
  onSuccess?: (result: StrimzSubscriptionResult) => void
  /** Called when the payer cancels or closes the popup. */
  onCancel?: () => void
  onError?: (error: StrimzSubscriptionError) => void
}

export interface UseStrimzSubscribeResult {
  open: (planId: string) => void
  close: () => void
  status: HostedPopupStatus
}

/**
 *   const subscribe = useStrimzSubscribe({ onSuccess: ({ subscriptionId }) => ... })
 *   <button onClick={() => subscribe.open(planId)}>Subscribe</button>
 */
export function useStrimzSubscribe(
  options: UseStrimzSubscribeOptions = {},
): UseStrimzSubscribeResult {
  return useHostedPopup({
    url: subscriptionUrl,
    read: (ev, expected) => readSubscriptionResult(ev, { ...expected, planId: expected.id }),
    mode: options.mode,
    onClosed: options.onCancel,
    onMessage: (data) => {
      switch (data.type) {
        case 'strimz:subscription:success':
          options.onSuccess?.({ subscriptionId: data.subscriptionId, txHash: data.txHash })
          return 'success'
        case 'strimz:subscription:cancel':
          options.onCancel?.()
          return 'cancelled'
        case 'strimz:subscription:error':
          options.onError?.(new StrimzSubscriptionError(data.code, data.planId, data.message))
          return 'error'
      }
    },
  })
}
