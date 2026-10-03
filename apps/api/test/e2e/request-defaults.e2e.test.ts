import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

const MINUTE = 60_000
const DAY = 86_400_000

describe('request bodies that omit a defaulted field get the schema default', () => {
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

  async function registeredMerchantKey() {
    const m = await seedMerchant(t.prisma.db, {
      onboardingCompleted: true,
      walletAddress: '0x00000000000000000000000000000000000000d1',
      onchainMerchantId: 1,
    })
    const k = await seedApiKey(t.prisma.db, m.id)
    return { m, k }
  }

  it('payment session without expiresInMinutes expires 30 minutes after creation', async () => {
    const { k } = await registeredMerchantKey()
    const before = Date.now()
    const res = await t.inject({
      method: 'POST',
      url: '/v1/payment-sessions',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { amount: '1000000', currency: 'USDC' },
    })
    const after = Date.now()
    expect(res.statusCode).toBe(201)
    const row = await t.prisma.db.paymentSession.findUniqueOrThrow({
      where: { id: JSON.parse(res.body).id },
    })
    expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 30 * MINUTE)
    expect(row.expiresAt.getTime()).toBeLessThanOrEqual(after + 30 * MINUTE)
  })

  it('subscription plan without intervalCount stores 1', async () => {
    const { k } = await registeredMerchantKey()
    const res = await t.inject({
      method: 'POST',
      url: '/v1/subscription-plans',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { name: 'Pro', amount: '20000000', currency: 'USDC', interval: 'monthly' },
    })
    expect(res.statusCode).toBe(201)
    const row = await t.prisma.db.subscriptionPlan.findUniqueOrThrow({
      where: { id: JSON.parse(res.body).id },
    })
    expect(row.intervalCount).toBe(1)
  })

  it('invoice without dueInDays is due 7 days after creation', async () => {
    const { k } = await registeredMerchantKey()
    const before = Date.now()
    const res = await t.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        currency: 'USDC',
        lineItems: [{ description: 'Seat', quantity: 1, unitAmount: '1000000' }],
      },
    })
    const after = Date.now()
    expect(res.statusCode).toBe(201)
    const row = await t.prisma.db.invoice.findUniqueOrThrow({
      where: { id: JSON.parse(res.body).id },
    })
    expect(row.dueAt.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY)
    expect(row.dueAt.getTime()).toBeLessThanOrEqual(after + 7 * DAY)
  })

  it('storefront without socialLinks and product without sortOrder store their defaults', async () => {
    const m = await seedMerchant(t.prisma.db)
    const auth = { authorization: `Bearer ${m.privyAccessToken}` }
    const storefront = await t.inject({
      method: 'POST',
      url: '/v1/storefront',
      headers: auth,
      payload: {
        slug: 'defaults-shop',
        name: 'Defaults Shop',
        description: null,
        logoUrl: null,
        coverImageUrl: null,
        accentColor: null,
      },
    })
    expect(storefront.statusCode).toBe(201)
    const product = await t.inject({
      method: 'POST',
      url: '/v1/storefront/products',
      headers: auth,
      payload: {
        name: 'Widget',
        description: null,
        price: '5000000',
        currency: 'USDC',
        type: 'one_time',
        interval: null,
        intervalCount: null,
        stock: null,
        isActive: true,
      },
    })
    expect(product.statusCode).toBe(201)

    const storefrontRow = await t.prisma.db.storefront.findFirstOrThrow({
      where: { merchantId: m.id },
    })
    expect(storefrontRow.socialLinks).toEqual([])
    const productRow = await t.prisma.db.storefrontProduct.findUniqueOrThrow({
      where: { id: JSON.parse(product.body).id },
    })
    expect(productRow.sortOrder).toBe(0)
  })
})
