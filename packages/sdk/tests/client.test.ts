import { afterEach, describe, it, expect, vi } from 'vitest'
import pkg from '../package.json' with { type: 'json' }
import { StrimzClient, StrimzBrowserClient, StrimzAuthenticationError } from '../src/index.js'

function notFound(): Response {
  return new Response(JSON.stringify({ error: { code: 'not_found', message: 'gone' } }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  return init.headers as Record<string, string>
}

describe('StrimzClient construction', () => {
  it('detects test mode from a sk_test_ key', () => {
    const c = new StrimzClient({ apiKey: 'sk_test_' + 'a'.repeat(20) })
    expect(c.mode).toBe('test')
  })

  it('detects live mode from a sk_live_ key', () => {
    const c = new StrimzClient({ apiKey: 'sk_live_' + 'a'.repeat(20) })
    expect(c.mode).toBe('live')
  })

  it('rejects publishable keys', () => {
    expect(() => new StrimzClient({ apiKey: 'pk_test_' + 'a'.repeat(20) })).toThrow(
      StrimzAuthenticationError,
    )
  })

  it('rejects unknown prefixes', () => {
    expect(() => new StrimzClient({ apiKey: 'bogus_test_' + 'a'.repeat(20) })).toThrow(
      StrimzAuthenticationError,
    )
  })

  it('rejects empty key', () => {
    // @ts-expect-error testing runtime guard
    expect(() => new StrimzClient({ apiKey: '' })).toThrow(StrimzAuthenticationError)
  })

  it('exposes every resource', () => {
    const c = new StrimzClient({ apiKey: 'sk_test_' + 'a'.repeat(20) })
    expect(c.paymentSessions).toBeDefined()
    expect(c.subscriptions).toBeDefined()
    expect(c.refunds).toBeDefined()
    expect(c.webhookEndpoints).toBeDefined()
    expect(c.webhookDeliveries).toBeDefined()
    expect(c.invoices).toBeDefined()
    expect(c.storefronts).toBeDefined()
    expect(c.agents).toBeDefined()
  })
})

describe('StrimzBrowserClient', () => {
  it('accepts a publishable key', () => {
    const c = new StrimzBrowserClient({ publishableKey: 'pk_test_' + 'a'.repeat(20) })
    expect(c.mode).toBe('test')
    // Browser checkout reads went through paymentSessions.retrieve before
    // #70 dropped that property in favour of the public /v1/checkout/*
    // namespace. The `checkout` resource is the replacement.
    expect(c.checkout.session).toBeTypeOf('function')
    expect(c.checkout.plan).toBeTypeOf('function')
  })

  it('rejects a secret key', () => {
    expect(() => new StrimzBrowserClient({ publishableKey: 'sk_test_' + 'a'.repeat(20) })).toThrow(
      StrimzAuthenticationError,
    )
  })
})

describe('X-Strimz-Sdk-Version', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('StrimzClient sends the package version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(notFound())
    const c = new StrimzClient({
      apiKey: 'sk_test_' + 'a'.repeat(20),
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
    })
    await expect(c.paymentSessions.retrieve('ps_1')).rejects.toThrow()
    expect(sentHeaders(fetchMock)['X-Strimz-Sdk-Version']).toBe(pkg.version)
  })

  it('StrimzBrowserClient sends the package version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(notFound())
    vi.stubGlobal('fetch', fetchMock)
    const c = new StrimzBrowserClient({ publishableKey: 'pk_test_' + 'a'.repeat(20) })
    await expect(c.checkout.session('ps_1')).rejects.toThrow()
    expect(sentHeaders(fetchMock)['X-Strimz-Sdk-Version']).toBe(pkg.version)
  })
})
