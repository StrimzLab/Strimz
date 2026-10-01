import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedApiKey,
  seedMerchant,
  seedPaymentSession,
  seedPlan,
  seedStorefront,
  seedStorefrontProduct,
} from '../helpers/fixtures.js'

describe('storefront checkout e2e', () => {
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

  const buy = (slug: string, productId: string) =>
    t.inject({ method: 'POST', url: `/store/${slug}/products/${productId}/checkout`, payload: {} })

  const stockOf = async (id: string) =>
    (await t.prisma.db.storefrontProduct.findUniqueOrThrow({ where: { id } })).stock

  it('sells the last unit once under concurrent checkouts and links the session to the product', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
    const sf = await seedStorefront(t.prisma.db, m.id, 'shop')
    const product = await seedStorefrontProduct(t.prisma.db, sf.id, { stock: 1 })

    const [a, b] = await Promise.all([buy('shop', product.id), buy('shop', product.id)])
    const codes = [a.statusCode, b.statusCode].sort()
    expect(codes).toEqual([201, 409])
    const rejected = a.statusCode === 409 ? a : b
    expect(JSON.parse(rejected.body).error.code).toBe('sold_out')
    expect(await stockOf(product.id)).toBe(0)

    const accepted = a.statusCode === 201 ? a : b
    const session = await t.prisma.db.paymentSession.findUniqueOrThrow({
      where: { id: JSON.parse(accepted.body).ref },
    })
    expect(session.storefrontProductId).toBe(product.id)
  })

  it('returns the unit once when the session is cancelled', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
    const k = await seedApiKey(t.prisma.db, m.id)
    const sf = await seedStorefront(t.prisma.db, m.id, 'shop')
    const product = await seedStorefrontProduct(t.prisma.db, sf.id, { stock: 0 })
    const session = await seedPaymentSession(t.prisma.db, m.id, {
      storefrontProductId: product.id,
    })

    const cancel = () =>
      t.inject({
        method: 'POST',
        url: `/v1/payment-sessions/${session.id}/cancel`,
        headers: { authorization: `Bearer ${k.secretKey}` },
        payload: {},
      })
    expect((await cancel()).statusCode).toBe(201)
    expect(await stockOf(product.id)).toBe(1)
    expect((await cancel()).statusCode).toBe(403)
    expect(await stockOf(product.id)).toBe(1)
  })

  it('returns the unit when the session is expired through the API', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
    const k = await seedApiKey(t.prisma.db, m.id)
    const sf = await seedStorefront(t.prisma.db, m.id, 'shop')
    const product = await seedStorefrontProduct(t.prisma.db, sf.id, { stock: 2 })
    const session = await seedPaymentSession(t.prisma.db, m.id, {
      status: 'awaiting_payment',
      storefrontProductId: product.id,
    })

    const res = await t.inject({
      method: 'POST',
      url: `/v1/payment-sessions/${session.id}/expire`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(res.statusCode).toBe(201)
    expect(await stockOf(product.id)).toBe(3)
  })

  it('leaves unlimited stock untouched on reserve and release', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
    const k = await seedApiKey(t.prisma.db, m.id, { mode: 'live' })
    const sf = await seedStorefront(t.prisma.db, m.id, 'shop')
    const product = await seedStorefrontProduct(t.prisma.db, sf.id, { stock: null })

    const res = await buy('shop', product.id)
    expect(res.statusCode).toBe(201)
    expect(await stockOf(product.id)).toBeNull()

    const cancel = await t.inject({
      method: 'POST',
      url: `/v1/payment-sessions/${JSON.parse(res.body).ref}/cancel`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(cancel.statusCode).toBe(201)
    expect(await stockOf(product.id)).toBeNull()
  })

  describe('subscription products', () => {
    const createProduct = (token: string, payload: Record<string, unknown>) =>
      t.inject({
        method: 'POST',
        url: '/v1/storefront/products',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: 'Pro monthly',
          description: null,
          price: '20000000',
          currency: 'USDC',
          type: 'subscription',
          interval: 'monthly',
          intervalCount: 1,
          stock: null,
          isActive: true,
          ...payload,
        },
      })

    it('rejects a subscription product without a plan', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      await seedStorefront(t.prisma.db, m.id, 'shop')
      const res = await createProduct(m.privyAccessToken, {})
      expect(res.statusCode).toBe(400)
    })

    it("rejects another merchant's plan", async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      const other = await seedMerchant(t.prisma.db)
      await seedStorefront(t.prisma.db, m.id, 'shop')
      const plan = await seedPlan(t.prisma.db, other.id)
      const res = await createProduct(m.privyAccessToken, { planId: plan.id })
      expect(res.statusCode).toBe(400)
      expect(await t.prisma.db.storefrontProduct.count()).toBe(0)
    })

    it('rejects a plan whose price differs from the product', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      await seedStorefront(t.prisma.db, m.id, 'shop')
      const plan = await seedPlan(t.prisma.db, m.id, { amount: '30000000' })
      const res = await createProduct(m.privyAccessToken, { planId: plan.id })
      expect(res.statusCode).toBe(400)
    })

    it('rejects a plan on a one-time product', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      await seedStorefront(t.prisma.db, m.id, 'shop')
      const plan = await seedPlan(t.prisma.db, m.id)
      const res = await createProduct(m.privyAccessToken, {
        type: 'one_time',
        interval: null,
        intervalCount: null,
        planId: plan.id,
      })
      expect(res.statusCode).toBe(400)
    })

    it('links a matching plan and checks out to the subscription page', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      await seedStorefront(t.prisma.db, m.id, 'shop')
      const plan = await seedPlan(t.prisma.db, m.id)
      const res = await createProduct(m.privyAccessToken, { planId: plan.id })
      expect(res.statusCode).toBe(201)
      const product = JSON.parse(res.body)
      expect(product.planId).toBe(plan.id)

      const checkout = await buy('shop', product.id)
      expect(checkout.statusCode).toBe(201)
      const body = JSON.parse(checkout.body)
      expect(body.kind).toBe('subscription_plan')
      expect(body.ref).toBe(plan.id)
    })
  })
})
