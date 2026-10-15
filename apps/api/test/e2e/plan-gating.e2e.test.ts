import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { MerchantTier } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedStorefront } from '../helpers/fixtures.js'

const STOREFRONT = {
  slug: 'plan-shop',
  name: 'Plan Shop',
  description: null,
  logoUrl: null,
  coverImageUrl: null,
  accentColor: null,
  socialLinks: [],
}

const PRODUCT = {
  name: 'Widget',
  description: null,
  price: '5000000',
  currency: 'USDC',
  type: 'one_time',
  interval: null,
  intervalCount: null,
  stock: null,
  isActive: true,
}

describe('plan-limited features', () => {
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

  const errorOf = (body: string) =>
    (JSON.parse(body) as { error: { code: string; details?: Record<string, unknown> } }).error

  function post(token: string, url: string, payload: Record<string, unknown> = {}) {
    return t.inject({
      method: 'POST',
      url,
      headers: { authorization: `Bearer ${token}` },
      payload,
    })
  }

  function patchAgentConfig(token: string, payload: Record<string, unknown>) {
    return t.inject({
      method: 'PATCH',
      url: '/v1/agents/config',
      headers: { authorization: `Bearer ${token}` },
      payload,
    })
  }

  function expectPlanRequired(res: { statusCode: number; body: string }, feature: string) {
    expect(res.statusCode).toBe(403)
    const error = errorOf(res.body)
    expect(error.code).toBe('plan_required')
    expect(error.details).toEqual({ feature, plan: 'free', requiredPlan: 'starter' })
  }

  describe('the storefront builder', () => {
    it('refuses a Free merchant creating a storefront and creates nothing', async () => {
      const m = await seedMerchant(t.prisma.db)

      const res = await post(m.privyAccessToken, '/v1/storefront', STOREFRONT)

      expectPlanRequired(res, 'storefront')
      expect(await t.prisma.db.storefront.count()).toBe(0)
    })

    it('refuses a Free merchant publishing or adding a product', async () => {
      const m = await seedMerchant(t.prisma.db)
      await seedStorefront(t.prisma.db, m.id, 'free-shop')

      expectPlanRequired(await post(m.privyAccessToken, '/v1/storefront/publish'), 'storefront')
      expectPlanRequired(
        await post(m.privyAccessToken, '/v1/storefront/products', PRODUCT),
        'storefront',
      )
      expect(await t.prisma.db.storefrontProduct.count()).toBe(0)
    })

    it.each<MerchantTier>(['starter', 'growth', 'enterprise'])(
      'lets a %s merchant build and publish a storefront',
      async (tier) => {
        const m = await seedMerchant(t.prisma.db, { tier })

        expect((await post(m.privyAccessToken, '/v1/storefront', STOREFRONT)).statusCode).toBe(201)
        expect(
          (await post(m.privyAccessToken, '/v1/storefront/products', PRODUCT)).statusCode,
        ).toBe(201)
        expect((await post(m.privyAccessToken, '/v1/storefront/publish')).statusCode).toBe(201)
      },
    )
  })

  describe('agent insights', () => {
    it('refuses a Free merchant turning on yield recommendations', async () => {
      const m = await seedMerchant(t.prisma.db)

      const res = await patchAgentConfig(m.privyAccessToken, {
        cashflow: { autoConvertToYield: true },
      })

      expectPlanRequired(res, 'yield_recommendations')
      const stored = await t.prisma.db.agentMerchantConfig.findUnique({
        where: { merchantId: m.id },
      })
      expect(stored?.cashflowAutoConvertToYield ?? false).toBe(false)
    })

    it('refuses a Free merchant changing anomaly alert sensitivity', async () => {
      const m = await seedMerchant(t.prisma.db)

      const res = await patchAgentConfig(m.privyAccessToken, {
        cashflow: { anomalySensitivity: 'high' },
      })

      expectPlanRequired(res, 'anomaly_alerts')
    })

    it('lets a Free merchant turn on the cash-flow digest with the other settings unchanged', async () => {
      const m = await seedMerchant(t.prisma.db)

      const res = await patchAgentConfig(m.privyAccessToken, {
        enabledCapabilities: ['cashflow'],
        cashflow: { digestEnabled: true, anomalySensitivity: 'medium', autoConvertToYield: false },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).cashflow.digestEnabled).toBe(true)
    })

    it('lets a Starter merchant turn on yield recommendations and tune anomaly alerts', async () => {
      const m = await seedMerchant(t.prisma.db, { tier: 'starter' })

      const res = await patchAgentConfig(m.privyAccessToken, {
        cashflow: { autoConvertToYield: true, anomalySensitivity: 'high' },
      })

      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).cashflow).toMatchObject({
        autoConvertToYield: true,
        anomalySensitivity: 'high',
      })
    })
  })
})
