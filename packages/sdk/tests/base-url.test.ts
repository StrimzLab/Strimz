import { afterEach, describe, expect, it, vi } from 'vitest'
import { StrimzBrowserClient, StrimzClient } from '../src/index.js'

// ADR-2026-11-26-test-mode: going live is a key swap, so the key picks the host.
const notFound = () =>
  new Response(JSON.stringify({ error: { code: 'not_found', message: 'gone' } }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })

const sentUrl = (fetchMock: ReturnType<typeof vi.fn>) =>
  String((fetchMock.mock.calls[0] as [string, RequestInit])[0])

async function serverHost(apiKey: string, baseUrl?: string) {
  const fetchMock = vi.fn().mockResolvedValue(notFound())
  const c = new StrimzClient({ apiKey, baseUrl, fetch: fetchMock as typeof fetch, maxRetries: 0 })
  await expect(c.paymentSessions.retrieve('ps_1')).rejects.toThrow()
  return new URL(sentUrl(fetchMock)).origin
}

async function browserHost(publishableKey: string, baseUrl?: string) {
  const fetchMock = vi.fn().mockResolvedValue(notFound())
  vi.stubGlobal('fetch', fetchMock)
  const c = new StrimzBrowserClient({ publishableKey, baseUrl })
  await expect(c.checkout.session('ps_1')).rejects.toThrow()
  return new URL(sentUrl(fetchMock)).origin
}

const key = (prefix: string) => prefix + 'a'.repeat(20)

describe('default API host follows the key', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends a test secret key to the test API', async () => {
    expect(await serverHost(key('sk_test_'))).toBe('https://api-test.strimz.finance')
  })

  it('sends a live secret key to the live API', async () => {
    expect(await serverHost(key('sk_live_'))).toBe('https://api.strimz.finance')
  })

  it('sends a test publishable key to the test API', async () => {
    expect(await browserHost(key('pk_test_'))).toBe('https://api-test.strimz.finance')
  })

  it('sends a live publishable key to the live API', async () => {
    expect(await browserHost(key('pk_live_'))).toBe('https://api.strimz.finance')
  })

  it('lets an explicit baseUrl win', async () => {
    expect(await serverHost(key('sk_test_'), 'http://localhost:4000')).toBe('http://localhost:4000')
    expect(await browserHost(key('pk_live_'), 'http://localhost:4000')).toBe(
      'http://localhost:4000',
    )
  })
})
