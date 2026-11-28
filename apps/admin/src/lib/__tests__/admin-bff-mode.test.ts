import { afterEach, describe, expect, it, vi } from 'vitest'

// ADR-2026-11-26-test-mode: a write goes to the backend of the admin's selected mode,
// chosen from the build's own settings, never from a URL the browser sends.
function load(withTest: boolean) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_ARC_ENVIRONMENT', 'mainnet')
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com')
  vi.stubEnv('NEXT_PUBLIC_TEST_API_URL', withTest ? 'https://api-test.example.com' : '')
  vi.stubEnv('NEXT_PUBLIC_TEST_CHECKOUT_URL', withTest ? 'https://checkout-test.example.com' : '')
  return import('@/app/api/admin/_lib/forward')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('adminUpstreamBase', () => {
  it('sends live writes, and writes without a mode, to the live API', async () => {
    const { adminUpstreamBase } = await load(true)
    expect(adminUpstreamBase('live')).toBe('https://api.example.com')
    expect(adminUpstreamBase(null)).toBe('https://api.example.com')
  })

  it('sends test writes to the test API', async () => {
    const { adminUpstreamBase } = await load(true)
    expect(adminUpstreamBase('test')).toBe('https://api-test.example.com')
  })

  it('refuses a mode the build does not have, or anything else', async () => {
    const { adminUpstreamBase } = await load(false)
    expect(adminUpstreamBase('test')).toBeNull()
    expect(adminUpstreamBase('https://evil.test')).toBeNull()
  })
})
