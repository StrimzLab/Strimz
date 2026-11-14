'use client'

import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const

/**
 * Runs `onIdle` after `timeoutMs` of no user activity. Any activity
 * resets the countdown, throttled to once a second so a moving mouse
 * doesn't rearm thousands of times. Pass `enabled = false` to disarm
 * (e.g. when the session isn't authenticated yet).
 */
export function useIdleLogout(timeoutMs: number, onIdle: () => void, enabled = true): void {
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let timer = 0
    let lastReset = 0

    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => onIdleRef.current(), timeoutMs)
    }

    const onActivity = () => {
      const now = Date.now()
      if (now - lastReset < 1_000) return
      lastReset = now
      arm()
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onActivity)
    arm()

    return () => {
      window.clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onActivity)
    }
  }, [timeoutMs, enabled])
}
