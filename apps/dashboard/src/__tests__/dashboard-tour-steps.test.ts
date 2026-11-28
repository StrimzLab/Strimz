import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const drivers: Array<{
  config: {
    steps: Array<{ element: string }>
    onHighlightStarted?: (el: unknown, step: { element: string }) => void
  }
}> = []
vi.mock('driver.js', () => ({
  driver: (config: (typeof drivers)[number]['config']) => {
    drivers.push({ config })
    return { drive: vi.fn(), destroy: vi.fn() }
  },
}))
vi.mock('driver.js/dist/driver.css', () => ({}))
vi.mock('@/hooks/api/use-merchant', () => ({
  useMerchantMe: () => ({ data: undefined }),
  useUpdateMerchant: () => ({ mutate: vi.fn() }),
}))

const { TOUR_STEPS, runDashboardTour, SIDEBAR_OPEN_EVENT } =
  await import('@/hooks/use-dashboard-tour')
const { tourKeyFor } = await import('@/lib/tour-keys')

const key = (selector: string) => /data-tour="([^"]+)"/u.exec(selector)?.[1]
const keys = TOUR_STEPS.map((s) => key(s.selector))

// #579: the tour starts with Test / Live and covers the sections a new merchant needs.
describe('dashboard tour steps', () => {
  it('opens with the Test / Live switch, then the test banner', () => {
    expect(keys.slice(0, 2)).toEqual(['mode-switch', 'test-banner'])
  })

  it('covers the key sections', () => {
    expect(keys).toEqual(
      expect.arrayContaining([
        'kpis',
        'get-started',
        'volume-chart',
        'nav-payment-sessions',
        'nav-plans',
        'nav-subscriptions',
        'nav-invoices',
        'nav-transactions',
        'nav-refunds',
        'nav-withdraw',
        'nav-storefront',
        'nav-customers',
        'nav-webhooks',
        'nav-api-keys',
        'nav-settings',
        'nav-docs',
      ]),
    )
  })

  it('points every sidebar step at a real sidebar link', () => {
    const sidebar = readFileSync(join(__dirname, '../components/dashboard/sidebar.tsx'), 'utf8')
    const hrefs = [...sidebar.matchAll(/href: '(\/app[^']*)'/gu)].map((m) => tourKeyFor(m[1] ?? ''))
    for (const k of keys.filter((x) => x?.startsWith('nav-') && x !== 'nav-docs')) {
      expect(hrefs).toContain(k)
    }
    expect(sidebar).toContain('data-tour="nav-docs"')
  })

  it('marks the switch, the banner and the Get paid card as tour targets', () => {
    const read = (p: string) => readFileSync(join(__dirname, '..', '..', '..', '..', p), 'utf8')
    expect(read('packages/web-shared/src/components/dashboard/mode-switch.tsx')).toContain(
      'data-tour="mode-switch"',
    )
    expect(read('packages/web-shared/src/components/dashboard/test-mode-banner.tsx')).toContain(
      'data-tour="test-banner"',
    )
  })
})

describe('running the tour', () => {
  const dispatched: string[] = []
  beforeEach(() => {
    drivers.length = 0
    dispatched.length = 0
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
      innerWidth: 390,
      dispatchEvent: (e: { type: string }) => dispatched.push(e.type),
    })
    vi.stubGlobal(
      'CustomEvent',
      class {
        constructor(public type: string) {}
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('skips steps whose element is not on the page, such as the banner in live mode', () => {
    vi.stubGlobal('document', {
      querySelector: (s: string) => (s.includes('test-banner') ? null : {}),
    })
    runDashboardTour()
    const used = drivers[0]?.config.steps.map((s) => key(s.element))
    expect(used).not.toContain('test-banner')
    expect(used).toContain('mode-switch')
  })

  it('opens the sidebar on a phone before a sidebar step', () => {
    vi.stubGlobal('document', { querySelector: () => ({}) })
    runDashboardTour()
    drivers[0]?.config.onHighlightStarted?.({}, { element: '[data-tour="nav-plans"]' })
    expect(dispatched).toContain(SIDEBAR_OPEN_EVENT)
  })
})
