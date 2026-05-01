import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedAgentConfig, seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { PricingService } from '../../src/capabilities/pricing/pricing.service.js'

describe('pricing intelligence e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.email.reset()
  })

  it('emails MRR + churn + forecast for merchants with pricing_intelligence enabled', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['pricing_intelligence'],
    })

    // Active subs → MRR
    const customer = await t.prisma.db.customer.create({
      data: { merchantId: merchant.id, walletAddress: '0x' + 'a'.repeat(40) },
    })
    const plan = await t.prisma.db.subscriptionPlan.create({
      data: {
        merchantId: merchant.id,
        name: 'Plan',
        amount: '20000000',
        currency: 'USDC',
        interval: 'monthly',
        intervalCount: 1,
      },
    })
    await t.prisma.db.subscription.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        planId: plan.id,
        status: 'active',
        payerAddress: customer.walletAddress,
        currency: 'USDC',
        amount: '20000000',
        interval: 'monthly',
        intervalCount: 1,
        currentPeriodStartAt: new Date(),
        currentPeriodEndAt: new Date(Date.now() + 30 * 86_400_000),
        gracePeriodHours: 48,
        mode: 'test',
      },
    })

    // 7 days of transactions for forecast.
    for (let i = 1; i <= 7; i++) {
      await seedTransaction(t.prisma.db, merchant.id, {
        netAmount: String(50_000_000 + i * 1_000_000),
        blockTimestamp: new Date(Date.now() - i * 86_400_000),
      })
    }

    const result = await t.app.get(PricingService).tick()
    expect(result.sent).toBe(1)
    expect(t.email.sent).toHaveLength(1)
    const html = t.email.sent[0]!.html
    expect(html).toContain('20') // MRR ≥ 20 USDC
    expect(html).toMatch(/Forecast confidence/)
  })

  it('skips when not enabled', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, { enabledCapabilities: ['cashflow'] })
    const result = await t.app.get(PricingService).tick()
    expect(result.sent).toBe(0)
    expect(t.email.sent).toHaveLength(0)
  })
})
