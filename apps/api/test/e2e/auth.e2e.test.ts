import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'

describe('auth e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
  })

  describe('POST /v1/auth/turnstile/verify', () => {
    it('returns ok=true for a valid Turnstile token', async () => {
      const res = await t.inject({
        method: 'POST',
        url: '/v1/auth/turnstile/verify',
        payload: { token: 'good-token' },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body)).toEqual({ ok: true })
    })

    it('returns 403 for an invalid Turnstile token', async () => {
      const res = await t.inject({
        method: 'POST',
        url: '/v1/auth/turnstile/verify',
        payload: { token: 'not-the-token' },
      })
      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body)
      expect(body.error.code).toBe('permission_denied')
    })

    it('returns 400 when the token field is missing', async () => {
      const res = await t.inject({
        method: 'POST',
        url: '/v1/auth/turnstile/verify',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('POST /v1/auth/sync', () => {
    it('creates a merchant on first call', async () => {
      const did = makePrivyDid('founder@acme.test')
      const token = `test|${did}|founder@acme.test|`

      const res = await t.inject({
        method: 'POST',
        url: '/v1/auth/sync',
        payload: { accessToken: token },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.isNewMerchant).toBe(true)
      expect(body.merchant.email).toBe('founder@acme.test')

      const row = await t.prisma.db.merchant.findUnique({ where: { privyUserId: did } })
      expect(row).not.toBeNull()
      expect(row!.emailVerified).toBe(true)
    })

    it('is idempotent — second call updates instead of duplicating', async () => {
      const token = `test|${makePrivyDid('repeat@x.test')}|repeat@x.test|`

      const r1 = await t.inject({ method: 'POST', url: '/v1/auth/sync', payload: { accessToken: token } })
      const r2 = await t.inject({ method: 'POST', url: '/v1/auth/sync', payload: { accessToken: token } })

      expect(r1.statusCode).toBe(200)
      expect(r2.statusCode).toBe(200)
      expect(JSON.parse(r1.body).isNewMerchant).toBe(true)
      expect(JSON.parse(r2.body).isNewMerchant).toBe(false)

      const count = await t.prisma.db.merchant.count()
      expect(count).toBe(1)
    })

    it('rejects an invalid Privy token', async () => {
      const res = await t.inject({
        method: 'POST',
        url: '/v1/auth/sync',
        payload: { accessToken: 'totally-bogus' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET /v1/auth/me', () => {
    it('returns the merchant when a valid token + synced row exists', async () => {
      const token = `test|${makePrivyDid('me@x.test')}|me@x.test|`
      await t.inject({ method: 'POST', url: '/v1/auth/sync', payload: { accessToken: token } })

      const res = await t.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).email).toBe('me@x.test')
    })

    it('returns 401 with merchant_not_synced when token valid but no row', async () => {
      const token = `test|${makePrivyDid('orphan@x.test')}|orphan@x.test|`
      const res = await t.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(401)
      expect(JSON.parse(res.body).error.code).toBe('merchant_not_synced')
    })

    it('returns 401 without an Authorization header', async () => {
      const res = await t.inject({ method: 'GET', url: '/v1/auth/me' })
      expect(res.statusCode).toBe(401)
    })
  })
})
