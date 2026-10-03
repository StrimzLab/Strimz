import { buildCustomRoute } from 'next/dist/lib/build-custom-route'
import { describe, expect, it } from 'vitest'
import config from '../../next.config.mjs'

async function headersFor(pathname: string): Promise<Record<string, string>> {
  const rules = (await config.headers?.()) ?? []
  const resolved: Record<string, string> = {}
  for (const rule of rules) {
    const { regex } = buildCustomRoute('header', rule)
    if (!new RegExp(regex).test(pathname)) continue
    for (const { key, value } of rule.headers) resolved[key.toLowerCase()] = value
  }
  return resolved
}

const EVERY_ROUTE = [
  '/',
  '/pricing',
  '/login',
  '/app',
  '/app/payment-sessions',
  '/admin',
  '/docs/quickstart',
  '/store/acme',
  '/api/checkout/session',
  '/pay/ps_123',
  '/sub/plan_123',
]

const FRAMEABLE_CHECKOUT = ['/pay/ps_123', '/pay/ps_123/', '/sub/plan_123']

const NOT_FRAMEABLE = [
  '/',
  '/pricing',
  '/login',
  '/app',
  '/app/payment-sessions',
  '/admin',
  '/docs/quickstart',
  '/store/acme',
  '/payouts',
  '/subscribe',
  '/api/checkout/session',
]

describe('next.config images', () => {
  it('does not let the image optimizer fetch arbitrary hosts', () => {
    const patterns = config.images?.remotePatterns ?? []
    const domains = config.images?.domains ?? []
    expect(domains).toEqual([])
    for (const pattern of patterns) {
      const hostname = pattern instanceof URL ? pattern.hostname : pattern.hostname
      expect(hostname).not.toContain('*')
    }
  })
})

describe('next.config security headers', () => {
  it.each(EVERY_ROUTE)('sends the baseline security headers on %s', async (pathname) => {
    const headers = await headersFor(pathname)
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['strict-transport-security']).toBe('max-age=63072000')
    expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()')
  })

  it.each(NOT_FRAMEABLE)('refuses to be framed on %s', async (pathname) => {
    const headers = await headersFor(pathname)
    expect(headers['x-frame-options']).toBe('DENY')
  })

  it.each(FRAMEABLE_CHECKOUT)('lets merchants embed hosted checkout on %s', async (pathname) => {
    const headers = await headersFor(pathname)
    expect(headers['x-frame-options']).toBeUndefined()
    expect(headers['content-security-policy']).toBeUndefined()
  })
})
