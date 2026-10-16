import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedApiKey,
  seedMerchant,
  seedPaymentSession,
  seedStorefront,
  seedStorefrontProduct,
} from '../helpers/fixtures.js'

describe('one mode per deployment e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.chain.environment = 'testnet'
  })

  describe('on mainnet', () => {
    beforeEach(() => {
      t.chain.environment = 'mainnet'
    })

    it('refuses to mint a test key from the dashboard', async () => {
      const m = await seedMerchant(t.prisma.db)
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { name: 'sandbox', kind: 'secret', mode: 'test', scopes: ['sessions_read'] },
      })
      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('mode_unavailable')
      expect(await t.prisma.db.merchantApiKey.count()).toBe(0)
    })

    it('refuses a request made with a test key', async () => {
      const m = await seedMerchant(t.prisma.db)
      const k = await seedApiKey(t.prisma.db, m.id, { mode: 'test' })
      const res = await t.inject({
        method: 'GET',
        url: '/v1/payment-sessions',
        headers: { authorization: `Bearer ${k.secretKey}` },
      })
      expect(res.statusCode).toBe(403)
      const error = JSON.parse(res.body).error
      expect(error.code).toBe('mode_unavailable')
      expect(error.message).toMatch(/test[\s\S]*live/u)
    })

    it('serves dashboard requests in live mode whatever x-strimz-mode says', async () => {
      const m = await seedMerchant(t.prisma.db)
      const live = await seedPaymentSession(t.prisma.db, m.id, { mode: 'live' })
      await seedPaymentSession(t.prisma.db, m.id, { mode: 'test' })
      const res = await t.inject({
        method: 'GET',
        url: '/v1/payment-sessions',
        headers: { authorization: `Bearer ${m.privyAccessToken}`, 'x-strimz-mode': 'test' },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data.map((s: { id: string }) => s.id)).toEqual([live.id])
    })
  })

  describe('on testnet', () => {
    it('refuses a request made with a live key', async () => {
      const m = await seedMerchant(t.prisma.db)
      const k = await seedApiKey(t.prisma.db, m.id, { mode: 'live' })
      const res = await t.inject({
        method: 'GET',
        url: '/v1/payment-sessions',
        headers: { authorization: `Bearer ${k.secretKey}` },
      })
      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('mode_unavailable')
    })

    it('serves dashboard requests in test mode even when x-strimz-mode says live', async () => {
      const m = await seedMerchant(t.prisma.db)
      await seedPaymentSession(t.prisma.db, m.id, { mode: 'live' })
      const test = await seedPaymentSession(t.prisma.db, m.id, { mode: 'test' })
      const res = await t.inject({
        method: 'GET',
        url: '/v1/payment-sessions',
        headers: { authorization: `Bearer ${m.privyAccessToken}`, 'x-strimz-mode': 'live' },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data.map((s: { id: string }) => s.id)).toEqual([test.id])
    })

    it('creates storefront sessions in test mode', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      const sf = await seedStorefront(t.prisma.db, m.id, 'shop')
      const product = await seedStorefrontProduct(t.prisma.db, sf.id)
      const res = await t.inject({
        method: 'POST',
        url: `/store/shop/products/${product.id}/checkout`,
        payload: {},
      })
      expect(res.statusCode).toBe(201)
      const session = await t.prisma.db.paymentSession.findUniqueOrThrow({
        where: { id: JSON.parse(res.body).ref },
      })
      expect(session.mode).toBe('test')
    })
  })
})
