'use client'

import { useCallback, useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

import { useMerchantMe, useUpdateMerchant } from '@/hooks/api/use-merchant'

const LOCAL_KEY = 'strimz.tour.completed'

const STEPS: Array<{
  selector: string
  title: string
  description: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}> = [
  {
    selector: '[data-tour="kpis"]',
    title: 'Your business at a glance',
    description:
      'Monthly recurring revenue, active subscribers, the last 7 days of payments and open invoices. Click a card for the detail.',
    side: 'bottom',
  },
  {
    selector: '[data-tour="volume-chart"]',
    title: '30 days of confirmed volume',
    description:
      'Every confirmed payment lands here in real time. Use it to spot spikes and dry patches at a glance.',
    side: 'top',
  },
  {
    selector: '[data-tour="nav-payment-sessions"]',
    title: 'Payment links',
    description:
      'Create a link for a set amount and send it to a customer. No code needed. Watch it confirm as they pay.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-api-keys"]',
    title: 'API keys',
    description: 'Create a live key for your integration. Every key is scoped and revocable.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-webhooks"]',
    title: 'Webhooks',
    description:
      'Point Strimz at your backend. We sign every payload, retry on failure, and replay from the dashboard.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-settings"]',
    title: 'Settings',
    description:
      'Payout policy, business info, email preferences, and the on-chain safety controls all live here.',
    side: 'right',
  },
]

interface RunOptions {
  onComplete?: () => void
  /** Max time to wait for target elements to mount, in ms. */
  maxWaitMs?: number
}

let stopActive: (() => void) | null = null

/** Closes the tour without counting it as finished, e.g. on sign-out or a page change. */
export function stopDashboardTour(): void {
  stopActive?.()
}

/**
 * Kicks off the tour. Retries until at least the first target
 * (KPIs) is in the DOM so framer-motion / query hydration races
 * do not swallow the initial trigger.
 */
export function runDashboardTour({ onComplete, maxWaitMs = 3_000 }: RunOptions = {}): void {
  if (typeof window === 'undefined') return
  stopDashboardTour()
  const start = performance.now()
  let stopped = false
  let timer: number | undefined
  let tour: ReturnType<typeof driver> | undefined

  const stop = () => {
    stopped = true
    window.clearTimeout(timer)
    tour?.destroy()
    if (stopActive === stop) stopActive = null
  }
  stopActive = stop

  const attempt = () => {
    const available = STEPS.filter((s) => document.querySelector(s.selector))
    if (available.length === 0) {
      if (performance.now() - start < maxWaitMs) {
        timer = window.setTimeout(attempt, 120)
      } else if (stopActive === stop) {
        stopActive = null
      }
      return
    }
    tour = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: 'strimz-tour',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Finish',
      steps: available.map((s) => ({
        element: s.selector,
        popover: { title: s.title, description: s.description, side: s.side },
      })),
      onDestroyed: () => {
        if (stopActive === stop) stopActive = null
        if (!stopped) onComplete?.()
      },
    })
    tour.drive()
  }
  attempt()
}

export function useDashboardTour({ enabled }: { enabled: boolean }) {
  const { data: merchant } = useMerchantMe()
  const update = useUpdateMerchant()
  const started = useRef(false)

  const markCompleted = useCallback(() => {
    // Stamp local first so a network failure on the PATCH never leaves
    // the merchant re-running the tour on their next /app visit.
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_KEY, 'true')
    }
    if (!merchant) return
    const metadata = (merchant.metadata ?? {}) as Record<string, unknown>
    if (metadata.tourCompleted === true) return
    const next = { ...metadata, tourCompleted: true }
    update.mutate({ metadata: next as never })
  }, [merchant, update])

  useEffect(() => {
    if (!enabled || !merchant || started.current) return
    const metadata = (merchant.metadata ?? {}) as Record<string, unknown>
    const doneServer = metadata.tourCompleted === true
    const doneLocal =
      typeof window !== 'undefined' && window.localStorage.getItem(LOCAL_KEY) === 'true'
    if (doneServer || doneLocal) return
    started.current = true
    runDashboardTour({ onComplete: markCompleted })
  }, [enabled, merchant, markCompleted])

  return {
    /**
     * Manually launch the tour. Used by the topbar "Take a tour"
     * button. Persists `tourCompleted: true` on Finish/Close so a
     * later reload doesn't auto-fire it again.
     */
    launch: useCallback(() => {
      runDashboardTour({ onComplete: markCompleted })
    }, [markCompleted]),
  }
}
