'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { CheckoutResultMessage } from '@strimz/shared-types'
import { postCheckoutResult, resolveCheckoutHost } from '@/lib/checkout-result'

export function useCheckoutHost() {
  const searchParams = useSearchParams()
  const host = useMemo(() => resolveCheckoutHost(searchParams), [searchParams])
  const sent = useRef(new Set<string>())

  const report = useCallback(
    (message: CheckoutResultMessage) => {
      const key = message.type === 'strimz:checkout:error' ? message.code : message.type
      if (sent.current.has(key)) return
      sent.current.add(key)
      postCheckoutResult(host, message, {
        parent: window.parent === window ? null : window.parent,
        opener: window.opener as Window | null,
      })
    },
    [host],
  )

  return { host, report }
}
