import { describe, it, expect } from 'vitest'
import { StrimzClient, StrimzBrowserClient, StrimzAuthenticationError } from '../src/index.js'

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
    expect(c.paymentSessions.retrieve).toBeTypeOf('function')
  })

  it('rejects a secret key', () => {
    expect(
      () => new StrimzBrowserClient({ publishableKey: 'sk_test_' + 'a'.repeat(20) }),
    ).toThrow(StrimzAuthenticationError)
  })
})
