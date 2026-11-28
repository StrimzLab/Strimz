'use client'

import { useCallback, useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

import { useMerchantMe, useUpdateMerchant } from '@/hooks/api/use-merchant'

const LOCAL_KEY = 'strimz.tour.completed'

export const SIDEBAR_OPEN_EVENT = 'strimz:sidebar-open'

interface TourStep {
  selector: string
  title: string
  description: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

const nav = (key: string, title: string, description: string): TourStep => ({
  selector: `[data-tour="nav-${key}"]`,
  title,
  description,
  side: 'right',
})

/** First-visit order. Steps whose element isn't on the page are skipped (#579). */
export const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="mode-switch"]',
    title: 'Test and Live',
    description:
      'Test runs on testnet USDC from the faucet, so you can try everything for free. Live takes real payments. They never share data, and you go live by swapping test keys for live keys.',
    side: 'bottom',
  },
  {
    selector: '[data-tour="test-banner"]',
    title: "You're in test mode",
    description:
      'This bar stays up while you test, so test data is never mistaken for real money. It links to how test mode works.',
    side: 'bottom',
  },
  {
    selector: '[data-tour="kpis"]',
    title: 'Your business at a glance',
    description:
      'Monthly recurring revenue, active subscribers, the last 7 days of payments and open invoices. Click a card for the detail.',
    side: 'bottom',
  },
  {
    selector: '[data-tour="get-started"]',
    title: 'Get paid',
    description:
      'The quickest way to your first payment: create a link, share it, and watch it land. Or hand the developer steps to your team.',
    side: 'top',
  },
  {
    selector: '[data-tour="volume-chart"]',
    title: '30 days of confirmed volume',
    description: 'Every confirmed payment lands here. Use it to spot spikes and quiet days.',
    side: 'top',
  },
  nav(
    'payment-sessions',
    'Payment links',
    'Create a link for a set amount and send it to a customer. No code needed.',
  ),
  nav('plans', 'Plans', 'Set a price that repeats: weekly, monthly or yearly.'),
  nav(
    'subscriptions',
    'Subscriptions',
    'Customers on a plan. They approve once, and Strimz charges them every period.',
  ),
  nav('invoices', 'Invoices', 'Bill a customer with a due date. They pay from the invoice link.'),
  nav('storefront', 'Storefront', 'A simple shop for your products, with no code.'),
  nav('transactions', 'Transactions', 'Every payment that reached your wallet, with its receipt.'),
  nav('refunds', 'Refunds', 'Send money back to a customer, in full or in part.'),
  nav('withdraw', 'Withdraw', 'Move USDC or EURC from your wallet to any address.'),
  nav('customers', 'Customers', 'Everyone who has paid you, with their payments and plans.'),
  nav('agents', 'AutoPay Agent', 'Lets software agents pay you within limits you set.'),
  nav(
    'webhooks',
    'Webhooks',
    'Point Strimz at your backend. We sign every event, retry on failure, and let you replay.',
  ),
  nav(
    'api-keys',
    'API keys',
    'Use test keys while you build and live keys when you launch. Every key is scoped and revocable.',
  ),
  nav(
    'settings',
    'Settings',
    'Business details, payout wallet, email preferences and your passkey.',
  ),
  {
    selector: '[data-tour="nav-docs"]',
    title: 'Documentation',
    description: 'Guides, the API reference and the SDKs, including how test mode works.',
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
    const available = TOUR_STEPS.filter((s) => document.querySelector(s.selector))
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
      // The sidebar is a drawer on phones; open it so its links can be highlighted.
      onHighlightStarted: (_el, step) => {
        const target = typeof step.element === 'string' ? step.element : ''
        if (target.includes('data-tour="nav-') && window.innerWidth < 1024) {
          window.dispatchEvent(new CustomEvent(SIDEBAR_OPEN_EVENT))
        }
      },
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
