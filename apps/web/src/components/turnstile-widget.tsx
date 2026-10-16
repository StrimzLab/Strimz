'use client'

import { useEffect, useRef } from 'react'
import { useResolvedTheme } from '@strimz/ui'
import { env } from '@/lib/env'
import { turnstileTheme, type TurnstileTheme } from '@/lib/theme'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      action?: string
      theme?: TurnstileTheme
      callback: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
      'timeout-callback'?: () => void
    },
  ) => string
  remove?: (id: string) => void
}

function getTurnstile(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile
}

export function TurnstileWidget({
  action,
  resetKey,
  onToken,
  className,
}: {
  action: string
  resetKey: number
  onToken: (token: string | null) => void
  className?: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  const theme = turnstileTheme(useResolvedTheme())

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    const el = container.current
    if (!env.turnstileSiteKey || !el) return

    let widgetId: string | undefined
    let pollTimer = 0
    let cancelled = false
    const clearToken = () => onTokenRef.current(null)

    const renderWidget = () => {
      const turnstile = getTurnstile()
      if (cancelled || !turnstile) return
      el.innerHTML = ''
      widgetId = turnstile.render(el, {
        sitekey: env.turnstileSiteKey,
        action,
        theme,
        callback: (token) => onTokenRef.current(token),
        'error-callback': clearToken,
        'expired-callback': clearToken,
        'timeout-callback': clearToken,
      })
    }

    clearToken()
    if (getTurnstile()) {
      renderWidget()
    } else if (!document.querySelector('script[data-strimz-turnstile]')) {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.dataset.strimzTurnstile = 'true'
      script.onload = renderWidget
      document.head.appendChild(script)
    } else {
      pollTimer = window.setInterval(() => {
        if (getTurnstile()) {
          window.clearInterval(pollTimer)
          renderWidget()
        }
      }, 120)
    }

    return () => {
      cancelled = true
      if (pollTimer) window.clearInterval(pollTimer)
      const turnstile = getTurnstile()
      if (widgetId && turnstile?.remove) turnstile.remove(widgetId)
      else el.innerHTML = ''
    }
  }, [action, theme, resetKey])

  if (!env.turnstileSiteKey) return null
  return <div ref={container} className={className} />
}
