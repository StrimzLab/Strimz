import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedPaymentSession } from '../helpers/fixtures.js'

const DASHBOARD_ORIGIN = 'https://app.strimz.test'
const MERCHANT_ORIGIN = 'https://shop.random-merchant.example'
const TOKEN = '0x3600000000000000000000000000000000000000'
const SDK_HEADERS =
  'authorization,x-strimz-sdk,x-strimz-sdk-version,x-strimz-sdk-runtime,x-strimz-request-id'

function preflight(url: string, origin: string, method: string, headers: string) {
  return {
    method: 'OPTIONS' as const,
    url,
    headers: {
      origin,
      'access-control-request-method': method,
      'access-control-request-headers': headers,
    },
  }
}

describe('CORS policy splits public checkout routes from secret-key routes', () => {
  let t: TestApp
  let previousCorsOrigin: string | undefined

  beforeAll(async () => {
    previousCorsOrigin = process.env.CORS_ORIGIN
    process.env.CORS_ORIGIN = DASHBOARD_ORIGIN
    const { createTestApp } = await import('../helpers/test-app.factory.js')
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
    process.env.CORS_ORIGIN = previousCorsOrigin
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
  })

  describe('public checkout and token routes', () => {
    it('answers a checkout session read from any origin with a wildcard and no credentials', async () => {
      const m = await seedMerchant(t.prisma.db)
      const s = await seedPaymentSession(t.prisma.db, m.id)
      const res = await t.inject({
        method: 'GET',
        url: `/v1/checkout/sessions/${s.id}`,
        headers: { origin: MERCHANT_ORIGIN, authorization: 'Bearer pk_test_' + 'a'.repeat(20) },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['access-control-allow-origin']).toBe('*')
      expect(res.headers['access-control-allow-credentials']).toBeUndefined()
      expect(res.headers['access-control-expose-headers']).toContain('x-strimz-request-id')
    })

    it('answers a checkout preflight from any origin with the SDK headers allowed', async () => {
      const res = await t.inject(
        preflight('/v1/checkout/sessions/ses_any', MERCHANT_ORIGIN, 'GET', SDK_HEADERS),
      )
      expect(res.statusCode).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBe('*')
      expect(res.headers['access-control-allow-credentials']).toBeUndefined()
      const methods = String(res.headers['access-control-allow-methods'])
      expect(methods).toContain('GET')
      expect(methods).toContain('POST')
      expect(methods).not.toContain('DELETE')
      const allowed = String(res.headers['access-control-allow-headers']).toLowerCase()
      for (const h of SDK_HEADERS.split(',')) expect(allowed).toContain(h)
      expect(res.headers['access-control-max-age']).toBe('7200')
    })

    it('answers a payer POST preflight on checkout from any origin', async () => {
      const res = await t.inject(
        preflight('/v1/checkout/sessions/ses_any/payer', MERCHANT_ORIGIN, 'POST', 'content-type'),
      )
      expect(res.statusCode).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBe('*')
    })

    it('answers a token permit-nonce preflight from any origin', async () => {
      const res = await t.inject(
        preflight(`/v1/tokens/${TOKEN}/permit-nonce`, MERCHANT_ORIGIN, 'GET', SDK_HEADERS),
      )
      expect(res.statusCode).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBe('*')
      expect(res.headers['access-control-allow-credentials']).toBeUndefined()
    })

    it('gives the dashboard origin the same wildcard answer on public routes', async () => {
      const res = await t.inject(
        preflight('/v1/checkout/plans/plan_any', DASHBOARD_ORIGIN, 'GET', SDK_HEADERS),
      )
      expect(res.headers['access-control-allow-origin']).toBe('*')
      expect(res.headers['access-control-allow-credentials']).toBeUndefined()
    })
  })

  describe('secret-key and dashboard routes', () => {
    it('does not allow a payment session create preflight from a non-allowlisted origin', async () => {
      const res = await t.inject(
        preflight('/v1/payment-sessions', MERCHANT_ORIGIN, 'POST', 'authorization,content-type'),
      )
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
      expect(res.headers['access-control-allow-credentials']).toBeUndefined()
    })

    it('does not reflect a non-allowlisted origin on a secret-key request', async () => {
      const m = await seedMerchant(t.prisma.db)
      const k = await seedApiKey(t.prisma.db, m.id)
      const res = await t.inject({
        method: 'GET',
        url: '/v1/payment-sessions',
        headers: { origin: MERCHANT_ORIGIN, authorization: `Bearer ${k.secretKey}` },
      })
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('does not open the hosted storefront checkout to any origin', async () => {
      const res = await t.inject(
        preflight(
          '/store/acme/products/prod_any/checkout',
          MERCHANT_ORIGIN,
          'POST',
          'content-type',
        ),
      )
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('allows the allowlisted dashboard origin with credentials', async () => {
      const res = await t.inject(
        preflight(
          '/v1/payment-sessions',
          DASHBOARD_ORIGIN,
          'POST',
          'authorization,content-type,x-strimz-mode',
        ),
      )
      expect(res.statusCode).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBe(DASHBOARD_ORIGIN)
      expect(res.headers['access-control-allow-credentials']).toBe('true')
      expect(String(res.headers.vary)).toContain('Origin')
      const methods = String(res.headers['access-control-allow-methods'])
      expect(methods).toContain('PATCH')
      expect(methods).toContain('DELETE')
      expect(res.headers['access-control-max-age']).toBe('600')
    })

    it('reflects the allowlisted dashboard origin on an actual request', async () => {
      const m = await seedMerchant(t.prisma.db)
      const k = await seedApiKey(t.prisma.db, m.id)
      const res = await t.inject({
        method: 'GET',
        url: '/v1/payment-sessions',
        headers: { origin: DASHBOARD_ORIGIN, authorization: `Bearer ${k.secretKey}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['access-control-allow-origin']).toBe(DASHBOARD_ORIGIN)
      expect(res.headers['access-control-allow-credentials']).toBe('true')
    })
  })
})
