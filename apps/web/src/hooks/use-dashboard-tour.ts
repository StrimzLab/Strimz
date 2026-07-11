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
      'MRR, active subscribers, 7-day volume, open invoices. Click a card to jump to the detail view.',
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
    selector: '[data-tour="nav-api-keys"]',
    title: 'API keys',
    description:
      'Issue a test key first, then upgrade to live once your team is ready. Every key is scoped and revocable.',
    side: 'right',
  },
  {
    selector: '[data-tour="nav-payment-sessions"]',
    title: 'Payment sessions',
    description: 'Create a checkout link with one call. Watch it confirm as the payer signs.',
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

/**
 * Kicks off the tour. Retries until at least the first target
 * (KPIs) is in the DOM so framer-motion / query hydration races
 * do not swallow the initial trigger.
 */
export function runDashboardTour({ onComplete, maxWaitMs = 3_000 }: RunOptions = {}): void {
  if (typeof window === 'undefined') return
  const start = performance.now()

  const attempt = () => {
    const available = STEPS.filter((s) => document.querySelector(s.selector))
    if (available.length === 0) {
      if (performance.now() - start < maxWaitMs) {
        window.setTimeout(attempt, 120)
      }
      return
    }
    const d = driver({
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
      onDestroyed: () => onComplete?.(),
    })
    d.drive()
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
