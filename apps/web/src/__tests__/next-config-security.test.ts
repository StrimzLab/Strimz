import { buildCustomRoute } from 'next/dist/lib/build-custom-route'
import { ARC_CHAINS } from '@strimz/shared-config/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

function cspDirectives(policy: string | undefined): Map<string, string[]> {
  const directives = new Map<string, string[]>()
  for (const part of (policy ?? '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/)
    if (!name) continue
    expect(directives.has(name), `duplicate directive ${name}`).toBe(false)
    directives.set(name, sources)
  }
  return directives
}

async function reportOnlyPolicy(pathname: string): Promise<Map<string, string[]>> {
  const headers = await headersFor(pathname)
  return cspDirectives(headers['content-security-policy-report-only'])
}

const ARC_RPC_ORIGINS = Object.values(ARC_CHAINS).flatMap((chain) =>
  chain.rpcUrls.default.http.map((url) => new URL(url).origin),
)

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

const FRAMEABLE_CHECKOUT = ['/pay/ps_123', '/pay/ps_123/', '/sub/plan_123', '/pay', '/sub']

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

describe('next.config content security policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(EVERY_ROUTE)('reports, and does not enforce, the policy on %s', async (pathname) => {
    const headers = await headersFor(pathname)
    expect(headers['content-security-policy']).toBeUndefined()
    expect(headers['content-security-policy-report-only']).toBeDefined()
    expect(headers['reporting-endpoints']).toBe('csp-endpoint="/api/csp-report"')
  })

  it.each(EVERY_ROUTE)('locks down plugins, base and form targets on %s', async (pathname) => {
    const policy = await reportOnlyPolicy(pathname)
    expect(policy.get('default-src')).toEqual(["'self'"])
    expect(policy.get('object-src')).toEqual(["'none'"])
    expect(policy.get('base-uri')).toEqual(["'self'"])
    expect(policy.get('form-action')).toEqual(["'self'"])
    expect(policy.get('report-uri')).toEqual(['/api/csp-report'])
    expect(policy.get('report-to')).toEqual(['csp-endpoint'])
  })

  it.each(EVERY_ROUTE)(
    'allows only first-party, Privy and Turnstile scripts on %s',
    async (pathname) => {
      const policy = await reportOnlyPolicy(pathname)
      expect(policy.get('script-src')).toEqual([
        "'self'",
        "'unsafe-inline'",
        'https://auth.privy.io',
        'https://challenges.cloudflare.com',
      ])
    },
  )

  it('allows the Privy, WalletConnect and Turnstile frames', async () => {
    const policy = await reportOnlyPolicy('/login')
    const frames = policy.get('frame-src') ?? []
    for (const origin of [
      'https://auth.privy.io',
      'https://verify.walletconnect.com',
      'https://verify.walletconnect.org',
      'https://secure.walletconnect.org',
      'https://challenges.cloudflare.com',
    ]) {
      expect(frames).toContain(origin)
    }
    expect(frames).not.toContain('*')
  })

  it('lets the browser reach every Arc RPC in shared-config, Privy, WalletConnect and uploadthing', async () => {
    const policy = await reportOnlyPolicy('/pay/ps_123')
    const connect = policy.get('connect-src') ?? []
    expect(ARC_RPC_ORIGINS.length).toBeGreaterThan(0)
    for (const origin of [
      "'self'",
      ...ARC_RPC_ORIGINS,
      'https://auth.privy.io',
      'https://*.rpc.privy.systems',
      'wss://relay.walletconnect.com',
      'wss://relay.walletconnect.org',
      'https://rpc.walletconnect.org',
      'https://api.web3modal.org',
      'https://pulse.walletconnect.org',
      'https://*.ingest.uploadthing.com',
    ]) {
      expect(connect).toContain(origin)
    }
    expect(connect).not.toContain('*')
    expect(connect).not.toContain('https:')
  })

  it('adds the API and RPC origins from the public env', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.strimz.test/v1/')
    vi.stubEnv('NEXT_PUBLIC_ARC_RPC_URL', 'https://arc-rpc.strimz.test/key/abc')
    const connect = (await reportOnlyPolicy('/app')).get('connect-src') ?? []
    expect(connect).toContain('https://api.strimz.test')
    expect(connect).toContain('https://arc-rpc.strimz.test')
    expect(connect.join(' ')).not.toContain('/key/abc')
  })

  it('leaves out an API origin that is not configured instead of guessing one', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '')
    vi.stubEnv('NEXT_PUBLIC_ARC_RPC_URL', '')
    const connect = (await reportOnlyPolicy('/app')).get('connect-src') ?? []
    expect(connect.some((source) => source.includes('localhost'))).toBe(false)
  })

  it('fails loudly on a malformed API URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'not a url')
    await expect(headersFor('/app')).rejects.toThrow()
  })

  it.each(NOT_FRAMEABLE)('forbids every framing ancestor on %s', async (pathname) => {
    const policy = await reportOnlyPolicy(pathname)
    expect(policy.get('frame-ancestors')).toEqual(["'none'"])
  })

  it.each(FRAMEABLE_CHECKOUT)('lets any merchant frame hosted checkout on %s', async (pathname) => {
    const policy = await reportOnlyPolicy(pathname)
    expect(policy.get('frame-ancestors')).toEqual(['*'])
  })

  it('never allows eval', async () => {
    for (const pathname of EVERY_ROUTE) {
      const headers = await headersFor(pathname)
      expect(headers['content-security-policy-report-only']).not.toContain('unsafe-eval')
    }
  })
})
