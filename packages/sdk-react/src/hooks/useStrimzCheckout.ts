'use client'

import * as React from 'react'
import { useStrimzContext } from '../provider.js'

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
  const expectedOrigin = React.useMemo(() => {
    try {
      return new URL(checkoutOrigin).origin
    } catch {
      return checkoutOrigin
    }
  }, [checkoutOrigin])
  const [status, setStatus] = React.useState<UseStrimzCheckoutResult['status']>('idle')
  const popupRef = React.useRef<Window | null>(null)
  const optsRef = React.useRef(options)
  optsRef.current = options

  const close = React.useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }
    popupRef.current = null
  }, [])

  React.useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.origin !== expectedOrigin) return
      const data = ev.data as { type?: string; txHash?: string; message?: string }
      if (!data || typeof data.type !== 'string' || !data.type.startsWith('strimz:checkout:'))
        return

      switch (data.type) {
        case 'strimz:checkout:success':
          setStatus('success')
          optsRef.current.onSuccess?.(data.txHash)
          close()
          break
        case 'strimz:checkout:cancel':
          setStatus('cancelled')
          optsRef.current.onCancel?.()
          close()
          break
        case 'strimz:checkout:error':
          setStatus('error')
          optsRef.current.onError?.(new Error(data.message ?? 'Checkout error'))
          close()
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [expectedOrigin, close])

  const open = React.useCallback(
    (sessionId: string) => {
      // Payment sessions are hosted at /pay/{id}. (Subscriptions use /sub/{planId},
      // which is a plan-link flow, not this payment-session primitive.)
      const url = `${checkoutOrigin}/pay/${encodeURIComponent(sessionId)}`
      const mode = optsRef.current.mode ?? 'popup'
      if (mode === 'redirect') {
        window.location.assign(url)
        return
      }
      const w = window.open(url, 'strimz-checkout', 'width=480,height=720')
      popupRef.current = w
      setStatus('open')
      // Detect manual close.
      const closeWatch = setInterval(() => {
        if (!w || w.closed) {
          clearInterval(closeWatch)
          if (popupRef.current === w) {
            // Only treat as cancel if we haven't already transitioned out of `open`.
            setStatus((prev) => (prev === 'open' ? 'cancelled' : prev))
            popupRef.current = null
            if (status === 'open') optsRef.current.onCancel?.()
          }
        }
      }, 500)
    },
    [checkoutOrigin, status],
  )

  return { open, close, status }
}
