'use client'

import * as React from 'react'
import { useStrimzContext } from '../provider.js'
import { StrimzCheckoutError } from '../checkout-error.js'
import { checkoutOriginOf, checkoutUrl, readCheckoutResult } from '../checkout-message.js'

export type StrimzCheckoutTheme = 'light' | 'dark'

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
  theme?: StrimzCheckoutTheme
}

/**
 * Results only count from this iframe, for this session. Another frame on
 * the checkout origin could otherwise fake a success.
 */
export function StrimzCheckoutEmbed({
  sessionId,
  onSuccess,
  onCancel,
  onError,
  className,
  style,
  height = 600,
  theme,
}: StrimzCheckoutEmbedProps) {
  const { checkoutOrigin } = useStrimzContext()
  // `checkoutOrigin` may carry a path (e.g. https://strimz.finance/pay); a
  // postMessage `ev.origin` is scheme+host only, so compare against that.
  const expectedOrigin = React.useMemo(() => checkoutOriginOf(checkoutOrigin), [checkoutOrigin])
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)
  const [parentOrigin, setParentOrigin] = React.useState<string | null>(null)
  const handlersRef = React.useRef({ onSuccess, onCancel, onError })
  handlersRef.current = { onSuccess, onCancel, onError }

  React.useEffect(() => {
    setParentOrigin(window.location.origin)
  }, [])

  React.useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = readCheckoutResult(ev, {
        origin: expectedOrigin,
        source: frameRef.current?.contentWindow ?? null,
        sessionId,
      })
      if (!data) return

      switch (data.type) {
        case 'strimz:checkout:success':
          handlersRef.current.onSuccess?.(data.txHash)
          break
        case 'strimz:checkout:cancel':
          handlersRef.current.onCancel?.()
          break
        case 'strimz:checkout:error':
          handlersRef.current.onError?.(
            new StrimzCheckoutError(data.code, data.sessionId, data.message),
          )
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [expectedOrigin, sessionId])

  // Payment sessions are hosted at /pay/{id}.
  const src = parentOrigin
    ? checkoutUrl(checkoutOrigin, sessionId, { mode: 'embed', parentOrigin, theme })
    : undefined

  return (
    <div className={className} style={{ width: '100%', ...(style ?? {}) }}>
      <iframe
        ref={frameRef}
        src={src}
        title="Strimz checkout"
        allow="payment *; clipboard-write *"
        style={{ width: '100%', height, border: 0 }}
        data-strimz-checkout-embed
      />
    </div>
  )
}
