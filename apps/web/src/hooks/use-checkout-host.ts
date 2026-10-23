'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { CheckoutResultMessage, SubscriptionResultMessage } from '@strimz/shared-types'
import { postCheckoutResult, resolveCheckoutHost, type HostWindows } from '@/lib/checkout-result'
import { postSubscriptionResult } from '@/lib/subscription-result'

function hostWindows(): HostWindows {
  return {
    parent: window.parent === window ? null : window.parent,
    opener: window.opener as Window | null,
  }
}

export function useCheckoutHost() {
  const searchParams = useSearchParams()
  const host = useMemo(() => resolveCheckoutHost(searchParams), [searchParams])
  const sent = useRef(new Set<string>())

  const report = useCallback(
    (message: CheckoutResultMessage) => {
      const key = message.type === 'strimz:checkout:error' ? message.code : message.type
      if (sent.current.has(key)) return
      sent.current.add(key)
      postCheckoutResult(host, message, hostWindows())
    },
    [host],
  )

  return { host, report }
}

export function useSubscriptionHost() {
  const searchParams = useSearchParams()
  const host = useMemo(() => resolveCheckoutHost(searchParams), [searchParams])
  const sent = useRef(new Set<string>())

  const report = useCallback(
    (message: SubscriptionResultMessage) => {
      const key = message.type === 'strimz:subscription:error' ? message.code : message.type
      if (sent.current.has(key)) return
      sent.current.add(key)
      postSubscriptionResult(host, message, hostWindows())
    },
    [host],
  )

  return { host, report }
}
