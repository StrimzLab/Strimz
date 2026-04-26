'use client'

import * as React from 'react'
import type { PaymentSession } from '@strimz/shared-types'
import { useStrimzClient } from './useStrimzClient.js'

export interface UseStrimzSessionResult {
  session: PaymentSession | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export interface UseStrimzSessionOptions {
  /** Poll interval in milliseconds while the session is in a non-terminal state. */
  pollIntervalMs?: number
}

const TERMINAL_STATES: ReadonlyArray<PaymentSession['status']> = [
  'confirmed',
  'failed',
  'expired',
  'cancelled',
]

/**
 * Subscribe to a Strimz payment session. Polls until the session reaches
 * a terminal state, then stops.
 */
export function useStrimzSession(
  sessionId: string | null | undefined,
  options: UseStrimzSessionOptions = {},
): UseStrimzSessionResult {
  const client = useStrimzClient()
  const [session, setSession] = React.useState<PaymentSession | null>(null)
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<Error | null>(null)
  const cancelledRef = React.useRef(false)

  const fetchOnce = React.useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const next = await client.paymentSessions.retrieve(sessionId)
      if (!cancelledRef.current) {
        setSession(next)
        setError(null)
      }
    } catch (err) {
      if (!cancelledRef.current) setError(err as Error)
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  }, [client, sessionId])

  React.useEffect(() => {
    cancelledRef.current = false
    if (!sessionId) return

    void fetchOnce()
    const interval = options.pollIntervalMs ?? 3_000
    const timer = setInterval(() => {
      if (session && TERMINAL_STATES.includes(session.status)) return
      void fetchOnce()
    }, interval)

    return () => {
      cancelledRef.current = true
      clearInterval(timer)
    }
    // session is intentionally not in deps — interval reads the latest via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, fetchOnce, options.pollIntervalMs])

  return { session, loading, error, refresh: fetchOnce }
}
