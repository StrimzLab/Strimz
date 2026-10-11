import { afterEach, describe, expect, it, vi } from 'vitest'

function loadWith(environment: string) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_ARC_ENVIRONMENT', environment)
  return import('../dashboard-mode')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('dashboard mode', () => {
  it('is live on a mainnet deployment', async () => {
    const { getDashboardMode } = await loadWith('mainnet')
    expect(getDashboardMode()).toBe('live')
  })

  it('is test on a testnet deployment, whatever the browser stored', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => 'live', setItem: () => undefined } })
    const { getDashboardMode } = await loadWith('testnet')
    expect(getDashboardMode()).toBe('test')
  })
})
