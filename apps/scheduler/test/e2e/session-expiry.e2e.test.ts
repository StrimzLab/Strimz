import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { SessionExpiryService } from '../../src/crons/session-expiry/session-expiry.service.js'

describe('session-expiry cron e2e', () => {
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

  function seedProduct(storefrontId: string, stock: number | null) {
    return t.prisma.db.storefrontProduct.create({
      data: {
        storefrontId,
        name: 'Widget',
        price: '5000000',
        currency: 'USDC',
        type: 'one_time',
        stock,
      },
    })
  }

  function seedSession(
    merchantId: string,
    overrides: {
      status?: 'created' | 'awaiting_payment' | 'submitted'
      expiresAt: Date
      storefrontProductId?: string
    },
  ) {
    return t.prisma.db.paymentSession.create({
      data: {
        merchantId,
        status: overrides.status ?? 'awaiting_payment',
        amount: '5000000',
        currency: 'USDC',
        feeAmount: '75000',
        netAmount: '4925000',
        checkoutUrl: 'https://checkout.strimz.test/pay/x',
        mode: 'live',
        expiresAt: overrides.expiresAt,
        storefrontProductId: overrides.storefrontProductId ?? null,
      },
    })
  }

  it('returns reserved units of expired storefront sessions and leaves the rest alone', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sf = await t.prisma.db.storefront.create({
      data: { merchantId: merchant.id, slug: 'shop', name: 'Shop', status: 'published' },
    })
    const finite = await seedProduct(sf.id, 0)
    const unlimited = await seedProduct(sf.id, null)
    const past = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 60_000)

    await seedSession(merchant.id, { expiresAt: past, storefrontProductId: finite.id })
    await seedSession(merchant.id, { expiresAt: past, storefrontProductId: finite.id })
    await seedSession(merchant.id, { expiresAt: future, storefrontProductId: finite.id })
    await seedSession(merchant.id, {
      expiresAt: past,
      status: 'submitted',
      storefrontProductId: finite.id,
    })
    await seedSession(merchant.id, { expiresAt: past, storefrontProductId: unlimited.id })
    await seedSession(merchant.id, { expiresAt: past })

    const svc = t.app.get(SessionExpiryService)
    const first = await svc.sweepNow()
    expect(first.expired).toBe(4)

    const finiteAfter = await t.prisma.db.storefrontProduct.findUniqueOrThrow({
      where: { id: finite.id },
    })
    expect(finiteAfter.stock).toBe(2)
    const unlimitedAfter = await t.prisma.db.storefrontProduct.findUniqueOrThrow({
      where: { id: unlimited.id },
    })
    expect(unlimitedAfter.stock).toBeNull()

    const second = await svc.sweepNow()
    expect(second.expired).toBe(0)
    const finiteAgain = await t.prisma.db.storefrontProduct.findUniqueOrThrow({
      where: { id: finite.id },
    })
    expect(finiteAgain.stock).toBe(2)
  })
})
