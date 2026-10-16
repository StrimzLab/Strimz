'use client'

import * as React from 'react'
import { useStrimzContext } from '../provider.js'
import { StrimzCheckoutError } from '../checkout-error.js'
import { checkoutOriginOf, checkoutUrl, readCheckoutResult } from '../checkout-message.js'

export type CheckoutMode = 'redirect' | 'popup'

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
  status: 'idle' | 'open' | 'success' | 'cancelled' | 'error'
}

/**
 * Imperative checkout opener. Lower-level than `<StrimzPayButton/>`.
 *
 *   const checkout = useStrimzCheckout({ onSuccess: ... })
 *   <button onClick={() => checkout.open(sessionId)}>Pay</button>
 */
export function useStrimzCheckout(options: UseStrimzCheckoutOptions = {}): UseStrimzCheckoutResult {
  const { checkoutOrigin } = useStrimzContext()
  // `checkoutOrigin` may carry a path (e.g. https://strimz.finance/pay), but a
  // postMessage `ev.origin` is always scheme+host only — compare against that.
  const expectedOrigin = React.useMemo(() => checkoutOriginOf(checkoutOrigin), [checkoutOrigin])
  const [status, setStatus] = React.useState<UseStrimzCheckoutResult['status']>('idle')
  const statusRef = React.useRef(status)
  const popupRef = React.useRef<Window | null>(null)
  const sessionIdRef = React.useRef<string | null>(null)
  const optsRef = React.useRef(options)
  optsRef.current = options

  const close = React.useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }
    popupRef.current = null
  }, [])

  const transition = React.useCallback((next: UseStrimzCheckoutResult['status']) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  React.useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = readCheckoutResult(ev, {
        origin: expectedOrigin,
        source: popupRef.current,
        sessionId: sessionIdRef.current,
      })
      if (!data) return

      switch (data.type) {
        case 'strimz:checkout:success':
          transition('success')
          optsRef.current.onSuccess?.(data.txHash)
          close()
          break
        case 'strimz:checkout:cancel':
          transition('cancelled')
          optsRef.current.onCancel?.()
          close()
          break
        case 'strimz:checkout:error':
          transition('error')
          optsRef.current.onError?.(
            new StrimzCheckoutError(data.code, data.sessionId, data.message),
          )
          close()
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [expectedOrigin, close, transition])

  const open = React.useCallback(
    (sessionId: string) => {
      // Payment sessions are hosted at /pay/{id}. (Subscriptions use /sub/{planId},
      // which is a plan-link flow, not this payment-session primitive.)
      const mode = optsRef.current.mode ?? 'popup'
      if (mode === 'redirect') {
        window.location.assign(checkoutUrl(checkoutOrigin, sessionId, null))
        return
      }
      const url = checkoutUrl(checkoutOrigin, sessionId, {
        mode: 'popup',
        parentOrigin: window.location.origin,
      })
      const w = window.open(url, 'strimz-checkout', 'width=480,height=720')
      popupRef.current = w
      sessionIdRef.current = sessionId
      transition('open')
      // Detect manual close.
      const closeWatch = setInterval(() => {
        if (!w || w.closed) {
          clearInterval(closeWatch)
          if (popupRef.current === w) {
            // Only treat as cancel if we haven't already transitioned out of `open`.
            const wasOpen = statusRef.current === 'open'
            popupRef.current = null
            if (wasOpen) {
              transition('cancelled')
              optsRef.current.onCancel?.()
            }
          }
        }
      }, 500)
    },
    [checkoutOrigin, transition],
  )

  return { open, close, status }
}
