'use client'

import * as React from 'react'
import { useStrimzContext } from '../provider.js'
import { readSubscriptionResult, subscriptionUrl } from '../checkout-message.js'
import { StrimzSubscriptionError } from '../subscription-error.js'
import type { StrimzSubscriptionResult } from '../hooks/useStrimzSubscribe.js'
import type { StrimzCheckoutTheme } from './StrimzCheckoutEmbed.js'

export interface StrimzSubscriptionEmbedProps {
  planId: string
  onSuccess?: (result: StrimzSubscriptionResult) => void
  onCancel?: () => void
  onError?: (error: StrimzSubscriptionError) => void
  className?: string
  style?: React.CSSProperties
  /** Iframe height. Default 640. */
  height?: number | string
  theme?: StrimzCheckoutTheme
}

/** Results only count from this iframe, for this plan. */
export function StrimzSubscriptionEmbed({
  planId,
  onSuccess,
  onCancel,
  onError,
  className,
  style,
  height = 640,
  theme,
}: StrimzSubscriptionEmbedProps) {
  const { checkoutOrigin } = useStrimzContext()
  const frameRef = React.useRef<HTMLIFrameElement | null>(null)
  const [parentOrigin, setParentOrigin] = React.useState<string | null>(null)
  const handlersRef = React.useRef({ onSuccess, onCancel, onError })
  handlersRef.current = { onSuccess, onCancel, onError }

  React.useEffect(() => {
    setParentOrigin(window.location.origin)
  }, [])

  React.useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = readSubscriptionResult(ev, {
        origin: checkoutOrigin,
        source: frameRef.current?.contentWindow ?? null,
        planId,
      })
      if (!data) return

      switch (data.type) {
        case 'strimz:subscription:success':
          handlersRef.current.onSuccess?.({
            subscriptionId: data.subscriptionId,
            txHash: data.txHash,
          })
          break
        case 'strimz:subscription:cancel':
          handlersRef.current.onCancel?.()
          break
        case 'strimz:subscription:error':
          handlersRef.current.onError?.(
            new StrimzSubscriptionError(data.code, data.planId, data.message),
          )
          break
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [checkoutOrigin, planId])

  const src = parentOrigin
    ? subscriptionUrl(checkoutOrigin, planId, { mode: 'embed', parentOrigin, theme })
    : undefined

  return (
    <div className={className} style={{ width: '100%', ...(style ?? {}) }}>
      <iframe
        ref={frameRef}
        src={src}
        title="Strimz subscription checkout"
        allow="payment *; clipboard-write *"
        style={{ width: '100%', height, border: 0 }}
        data-strimz-subscription-embed
      />
    </div>
  )
}
