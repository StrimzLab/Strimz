'use client'

import * as React from 'react'
import { useStrimzContext } from '../provider.js'
import type { CheckoutHostParams } from '../checkout-message.js'

export type CheckoutMode = 'redirect' | 'popup'
export type HostedPopupStatus = 'idle' | 'open' | 'success' | 'cancelled' | 'error'
type Outcome = Exclude<HostedPopupStatus, 'idle' | 'open'>

/** The popup plumbing `useStrimzCheckout` and `useStrimzSubscribe` share. */
export function useHostedPopup<M>(config: {
  url: (checkoutOrigin: string, id: string, host: CheckoutHostParams | null) => string
  read: (
    ev: MessageEvent,
    expected: { origin: string; source: MessageEventSource | null; id: string | null },
  ) => M | null
  mode?: CheckoutMode
  onMessage: (message: M) => Outcome
  onClosed?: () => void
}) {
  const { checkoutOrigin } = useStrimzContext()
  const [status, setStatus] = React.useState<HostedPopupStatus>('idle')
  const statusRef = React.useRef(status)
  const popupRef = React.useRef<Window | null>(null)
  const idRef = React.useRef<string | null>(null)
  const configRef = React.useRef(config)
  configRef.current = config

  const close = React.useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close()
    }
    popupRef.current = null
  }, [])

  const transition = React.useCallback((next: HostedPopupStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  React.useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = configRef.current.read(ev, {
        origin: checkoutOrigin,
        source: popupRef.current,
        id: idRef.current,
      })
      if (data === null) return
      transition(configRef.current.onMessage(data))
      close()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [checkoutOrigin, close, transition])

  const open = React.useCallback(
    (id: string) => {
      const { url, mode = 'popup' } = configRef.current
      if (mode === 'redirect') {
        window.location.assign(url(checkoutOrigin, id, null))
        return
      }
      const w = window.open(
        url(checkoutOrigin, id, { mode: 'popup', parentOrigin: window.location.origin }),
        'strimz-checkout',
        'width=480,height=720',
      )
      popupRef.current = w
      idRef.current = id
      transition('open')
      const closeWatch = setInterval(() => {
        if (!w || w.closed) {
          clearInterval(closeWatch)
          if (popupRef.current === w) {
            // A result message already moved us out of `open`; that isn't a cancel.
            const wasOpen = statusRef.current === 'open'
            popupRef.current = null
            if (wasOpen) {
              transition('cancelled')
              configRef.current.onClosed?.()
            }
          }
        }
      }, 500)
    },
    [checkoutOrigin, transition],
  )

  return { open, close, status }
}
