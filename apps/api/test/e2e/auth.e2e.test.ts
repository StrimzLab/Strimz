import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'
import { must } from '../helpers/must.js'
import { PrivyWebhookService } from '../../src/modules/auth/privy-webhook.service.js'

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

  describe('POST /v1/auth/sync', () => {
    it('creates a merchant on first call', async () => {
      const did = makePrivyDid('founder@acme.test')
      const token = `test|${did}|founder@acme.test|`

      const res = await t.inject({
        method: 'POST',
        url: '/v1/auth/sync',
        payload: { accessToken: token, turnstileToken: 'good-token' },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.isNewMerchant).toBe(true)
      expect(body.merchant.email).toBe('founder@acme.test')

      const row = await t.prisma.db.merchant.findUnique({ where: { privyUserId: did } })
      expect(row).not.toBeNull()
      expect(must(row).emailVerified).toBe(true)
    })

    it('is idempotent — second call updates instead of duplicating', async () => {
      const token = `test|${makePrivyDid('repeat@x.test')}|repeat@x.test|`

      const r1 = await t.inject({
        method: 'POST',
        url: '/v1/auth/sync',
        payload: { accessToken: token, turnstileToken: 'good-token' },
      })
      const r2 = await t.inject({
        method: 'POST',
        url: '/v1/auth/sync',
        payload: { accessToken: token, turnstileToken: 'good-token' },
      })

      expect(r1.statusCode).toBe(200)
      expect(r2.statusCode).toBe(200)
      expect(JSON.parse(r1.body).isNewMerchant).toBe(true)
      expect(JSON.parse(r2.body).isNewMerchant).toBe(false)

      const count = await t.prisma.db.merchant.count()
      expect(count).toBe(1)
    })

    describe('bot check on account creation', () => {
      const sync = (accessToken: string, turnstileToken?: string) =>
        t.inject({
          method: 'POST',
          url: '/v1/auth/sync',
          payload: { accessToken, ...(turnstileToken === undefined ? {} : { turnstileToken }) },
        })
      const newUser = (email: string) => `test|${makePrivyDid(email)}|${email}|`

      it.each([
        ['no token', undefined],
        ['a failed token', 'bad-token'],
        ['a token from another form', 'good-token:contact'],
      ])('creates no account for a new user with %s', async (_label, turnstileToken) => {
        const res = await sync(newUser('bot@x.test'), turnstileToken)

        expect(res.statusCode).toBe(428)
        expect(JSON.parse(res.body).error.code).toBe('turnstile_required')
        expect(await t.prisma.db.merchant.count()).toBe(0)
      })

      it('creates the account with a token from the signup check', async () => {
        const res = await sync(newUser('human@x.test'), 'good-token:signup')

        expect(res.statusCode).toBe(200)
        expect(JSON.parse(res.body).isNewMerchant).toBe(true)
      })

      it('lets an existing merchant sign in without a token', async () => {
        const token = newUser('back@x.test')
        expect((await sync(token, 'good-token')).statusCode).toBe(200)

        const again = await sync(token)

        expect(again.statusCode).toBe(200)
        expect(JSON.parse(again.body).isNewMerchant).toBe(false)
      })
    })

    describe('privy webhook', () => {
      it('never creates an account', async () => {
        await t.app.get(PrivyWebhookService).handleEvent({
          type: 'user.authenticated',
          user: { id: makePrivyDid('ghost@x.test') },
        })

        expect(await t.prisma.db.merchant.count()).toBe(0)
      })

      it('still refreshes an existing account', async () => {
        const did = makePrivyDid('known@x.test')
        await t.inject({
          method: 'POST',
          url: '/v1/auth/sync',
          payload: { accessToken: `test|${did}|known@x.test|`, turnstileToken: 'good-token' },
        })
        await t.prisma.db.merchant.update({
          where: { privyUserId: did },
          data: { lastLoginAt: new Date(0) },
        })

        await t.app.get(PrivyWebhookService).handleEvent({
          type: 'user.authenticated',
          user: { id: did },
        })

        const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { privyUserId: did } })
        expect(must(row.lastLoginAt).getTime()).toBeGreaterThan(0)
      })
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
      await t.inject({
        method: 'POST',
        url: '/v1/auth/sync',
        payload: { accessToken: token, turnstileToken: 'good-token' },
      })

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
