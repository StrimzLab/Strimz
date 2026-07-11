'use client'

import * as React from 'react'
import { useStrimzContext } from '../provider.js'

export interface StrimzCheckoutEmbedProps {
  /** Strimz session id created via `@strimz/sdk` on your backend. */
  sessionId: string
  /** Called on a successful payment with the on-chain transaction hash. */
  onSuccess?: (txHash?: string) => void
  /** Called when the payer cancels. */
  onCancel?: () => void
  /** Called when the checkout reports an error. */
  onError?: (error: Error) => void
  /** Optional className to size / style the iframe wrapper. */
  className?: string
  /** Optional inline style for the iframe wrapper. */
  style?: React.CSSProperties
  /** Iframe height. Default 600. */
  height?: number | string
}

/**
 * Embeds Strimz hosted checkout inside the merchant's page in an iframe.
 *
 * The iframe communicates back via `postMessage`. All messages are filtered
 * by the configured `checkoutOrigin` so a malicious page on a different
 * origin cannot spoof success.
 */
export function StrimzCheckoutEmbed({
  sessionId,
  onSuccess,
  onCancel,
  onError,
  className,
  style,
  height = 600,
}: StrimzCheckoutEmbedProps) {
  const { checkoutOrigin } = useStrimzContext()
  // `checkoutOrigin` may carry a path (e.g. https://strimz.finance/pay); a
  // postMessage `ev.origin` is scheme+host only, so compare against that.
  const expectedOrigin = React.useMemo(() => {
    try {
      return new URL(checkoutOrigin).origin
    } catch {
      return checkoutOrigin
    }
  }, [checkoutOrigin])
  const handlersRef = React.useRef({ onSuccess, onCancel, onError })
  handlersRef.current = { onSuccess, onCancel, onError }

  React.useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.origin !== expectedOrigin) return
      const data = ev.data as { type?: string; txHash?: string; message?: string }
      if (!data || typeof data.type !== 'string') return

      switch (data.type) {
        case 'strimz:checkout:success':
          handlersRef.current.onSuccess?.(data.txHash)
          break
        case 'strimz:checkout:cancel':
          handlersRef.current.onCancel?.()
          break
        case 'strimz:checkout:error':
          handlersRef.current.onError?.(new Error(data.message ?? 'Checkout error'))
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [expectedOrigin])

  // Payment sessions are hosted at /pay/{id}.
  const src = `${checkoutOrigin}/pay/${encodeURIComponent(sessionId)}?embed=1`

  return (
    <div className={className} style={{ width: '100%', ...(style ?? {}) }}>
      <iframe
        src={src}
        title="Strimz checkout"
        allow="payment *; clipboard-write *"
        style={{ width: '100%', height, border: 0 }}
        data-strimz-checkout-embed
      />
    </div>
  )
}
