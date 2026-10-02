'use client'

import { useEffect, useRef } from 'react'

export function useRefreshWhile<T>(
  active: boolean,
  intervalMs: number,
  load: () => Promise<T>,
  onLoaded: (value: T) => void,
  onError: (err: Error) => void,
): void {
  const handlers = useRef({ load, onLoaded, onError })
  handlers.current = { load, onLoaded, onError }

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const timer = setInterval(() => {
      handlers.current
        .load()
        .then((value) => {
          if (!cancelled) handlers.current.onLoaded(value)
        })
        .catch((err: unknown) => {
          if (!cancelled) handlers.current.onError(err as Error)
        })
    }, intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [active, intervalMs])
}
