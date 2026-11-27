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

describe('initialMode (ADR-2026-11-26-test-mode)', () => {
  it('starts a new browser in test mode when test mode exists', async () => {
    const { initialMode } = await loadWith('mainnet')
    expect(initialMode(['test', 'live'], null)).toBe('test')
  })

  it('remembers the last choice', async () => {
    const { initialMode } = await loadWith('mainnet')
    expect(initialMode(['test', 'live'], 'live')).toBe('live')
  })

  it('ignores a stored mode this build does not have, or junk', async () => {
    const { initialMode } = await loadWith('mainnet')
    expect(initialMode(['live'], 'test')).toBe('live')
    expect(initialMode(['test', 'live'], 'sandbox')).toBe('test')
  })
})

describe('stored mode', () => {
  it('reads and writes the remembered mode', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    })
    const { readStoredMode, storeMode } = await loadWith('mainnet')
    storeMode('live')
    expect(readStoredMode()).toBe('live')
  })

  it('survives a browser that blocks storage', async () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
      },
    })
    const { readStoredMode, storeMode } = await loadWith('mainnet')
    expect(readStoredMode()).toBeNull()
    expect(() => storeMode('test')).not.toThrow()
  })
})
