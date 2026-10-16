import { describe, it, expect } from 'vitest'
import {
  allowlistedCorsOptions,
  isPublicCorsPath,
  parseCorsAllowlist,
  publicCorsOptions,
} from '../../../src/common/http/cors-policy.js'

describe('isPublicCorsPath', () => {
  it.each([
    '/v1/checkout/sessions/ses_1',
    '/v1/checkout/plans/plan_1/payer',
    '/v1/tokens/0x3600000000000000000000000000000000000000/permit-nonce',
    '/v1/checkout/sessions/ses_1?expand=merchant',
  ])('treats %s as public', (url) => {
    expect(isPublicCorsPath(url)).toBe(true)
  })

  it.each([
    '/v1/payment-sessions',
    '/v1/checkout',
    '/v1/checkoutx/sessions/ses_1',
    '/v1/tokensale/1',
    '/store/acme/products/prod_1/checkout',
    '/v1/payment-sessions?next=/v1/checkout/sessions/ses_1',
    '//v1/checkout/sessions/ses_1',
    '/V1/CHECKOUT/sessions/ses_1',
  ])('keeps %s allowlisted', (url) => {
    expect(isPublicCorsPath(url)).toBe(false)
  })
})

describe('parseCorsAllowlist', () => {
  it('keeps the wildcard as a wildcard', () => {
    expect(parseCorsAllowlist('*')).toBe('*')
  })

  it('splits, trims and drops empty entries', () => {
    expect(parseCorsAllowlist('https://a.test, https://b.test,')).toEqual([
      'https://a.test',
      'https://b.test',
    ])
  })
})

describe('allowlistedCorsOptions', () => {
  const allowlist = ['https://app.strimz.test']

  it('reflects an allowlisted origin with credentials', () => {
    const opts = allowlistedCorsOptions(allowlist, 'https://app.strimz.test')
    expect(opts.origin).toBe('https://app.strimz.test')
    expect(opts.credentials).toBe(true)
    expect(opts.maxAge).toBe(600)
  })

  it('disables CORS for any other origin', () => {
    expect(allowlistedCorsOptions(allowlist, 'https://shop.example').origin).toBe(false)
    expect(allowlistedCorsOptions(allowlist, undefined).origin).toBe(false)
  })

  it('reflects every origin when the allowlist is a wildcard', () => {
    expect(allowlistedCorsOptions('*', 'https://shop.example').origin).toBe(true)
  })
})

describe('publicCorsOptions', () => {
  it('answers every origin without credentials and caches the preflight for two hours', () => {
    const opts = publicCorsOptions()
    expect(opts.origin).toBe('*')
    expect(opts.credentials).toBe(false)
    expect(opts.methods).toEqual(['GET', 'HEAD', 'POST', 'OPTIONS'])
    expect(opts.maxAge).toBe(7200)
  })
})
