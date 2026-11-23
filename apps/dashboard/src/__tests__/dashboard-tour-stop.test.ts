import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface FakeDriver {
  config: { onDestroyed?: () => void }
  drive: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

const drivers: FakeDriver[] = []

vi.mock('driver.js', () => ({
  driver: (config: FakeDriver['config']) => {
    const d: FakeDriver = {
      config,
      drive: vi.fn(),
      destroy: vi.fn(() => config.onDestroyed?.()),
    }
    drivers.push(d)
    return d
  },
}))
vi.mock('driver.js/dist/driver.css', () => ({}))
vi.mock('@/hooks/api/use-merchant', () => ({
  useMerchantMe: () => ({ data: undefined }),
  useUpdateMerchant: () => ({ mutate: vi.fn() }),
}))

const { runDashboardTour, stopDashboardTour } = await import('@/hooks/use-dashboard-tour')

describe('stopping the dashboard tour', () => {
  beforeEach(() => {
    drivers.length = 0
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    vi.stubGlobal('document', { querySelector: () => ({}) })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // After an inactivity sign-out the overlay stayed on /login (#559).
  it('closes an open tour without marking it finished', () => {
    const onComplete = vi.fn()
    runDashboardTour({ onComplete })
    expect(drivers).toHaveLength(1)

    stopDashboardTour()

    expect(drivers[0]?.destroy).toHaveBeenCalledOnce()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('still marks it finished when the merchant closes it', () => {
    const onComplete = vi.fn()
    runDashboardTour({ onComplete })
    drivers[0]?.config.onDestroyed?.()
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('cancels a tour still waiting for its targets', () => {
    vi.stubGlobal('document', { querySelector: () => null })
    runDashboardTour({ maxWaitMs: 60_000 })
    stopDashboardTour()
    vi.stubGlobal('document', { querySelector: () => ({}) })
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(drivers).toHaveLength(0)
        resolve()
      }, 200)
    })
  })

  it('is stopped when the dashboard shell unmounts or the page changes', () => {
    const shell = readFileSync(
      join(__dirname, '../components/dashboard/dashboard-shell.tsx'),
      'utf8',
    )
    expect(shell).toMatch(/stopDashboardTour/u)
    expect(shell).toMatch(/usePathname/u)
  })
})
