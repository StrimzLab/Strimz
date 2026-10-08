import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedAgentConfig, seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { must } from '../helpers/must.js'
import { agentActivityLogSchema } from '@strimz/shared-types'
import { CashflowDigestService } from '../../src/capabilities/cashflow/digest.service.js'
import { CashflowAnomalyService } from '../../src/capabilities/cashflow/anomaly.service.js'
import { CashflowYieldService } from '../../src/capabilities/cashflow/yield-recommendation.service.js'
import { CommerceService } from '../../src/capabilities/commerce/commerce.service.js'
import { PricingService } from '../../src/capabilities/pricing/pricing.service.js'

type Currency = 'USDC' | 'EURC'

describe('agent keeps USDC and EURC apart', () => {
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

  const tx = (
    merchantId: string,
    currency: Currency,
    amount: string,
    at: Date,
    extra: { mode?: 'live' | 'test'; kind?: 'one_shot' | 'refund' } = {},
  ) =>
    seedTransaction(t.prisma.db, merchantId, {
      amount,
      netAmount: amount,
      feeAmount: '0',
      blockTimestamp: at,
      currency,
      ...extra,
    })

  const activityRow = async (merchantId: string) => {
    const row = must(await t.prisma.db.agentActivityLog.findFirst({ where: { merchantId } }))
    return {
      id: row.id,
      merchantId: row.merchantId,
      capability: row.capability,
      actionType: row.actionType,
      outcome: row.outcome,
      subscriptionId: row.subscriptionId,
      transactionId: row.transactionId,
      jobId: row.jobId,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
    }
  }

  it('digest reports revenue per currency', async () => {
    const m = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, m.id, {
      enabledCapabilities: ['cashflow'],
      cashflowDigestEnabled: true,
    })
    const yesterday = new Date(Date.UTC(2026, 8, 14, 12))
    await tx(m.id, 'USDC', '100000000', yesterday)
    await tx(m.id, 'EURC', '50000000', yesterday)

    await t.app.get(CashflowDigestService).tick(new Date(Date.UTC(2026, 8, 15, 9)))
    const html = must(t.email.sent[0]).html
    expect(html).not.toContain('150 USDC')
    expect(html).toContain('100 USDC')
    expect(html).toContain('50 EURC')
    const log = must(await t.prisma.db.agentActivityLog.findFirst({ where: { merchantId: m.id } }))
    const meta = log.metadata as Record<string, unknown>
    expect(meta).toMatchObject({
      revenueUsdc: '100000000',
      revenueEurc: '50000000',
      feesUsdc: '0',
      feesEurc: '0',
      netUsdc: '100000000',
      netEurc: '50000000',
    })
    expect(meta).not.toHaveProperty('revenue')
  })

  it('digest leaves out test-mode and refund transactions', async () => {
    const m = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, m.id, {
      enabledCapabilities: ['cashflow'],
      cashflowDigestEnabled: true,
    })
    const yesterday = new Date(Date.UTC(2026, 8, 14, 12))
    await tx(m.id, 'USDC', '100000000', yesterday)
    await tx(m.id, 'USDC', '7000000', yesterday, { mode: 'test' })
    await tx(m.id, 'USDC', '3000000', yesterday, { kind: 'refund' })

    await t.app.get(CashflowDigestService).tick(new Date(Date.UTC(2026, 8, 15, 9)))
    const meta = must(await t.prisma.db.agentActivityLog.findFirst({ where: { merchantId: m.id } }))
      .metadata as Record<string, unknown>
    expect(meta.revenueUsdc).toBe('100000000')
    expect(meta.count).toBe(1)
  })

  it('digest activity rows parse with the published activity schema', async () => {
    const m = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, m.id, {
      enabledCapabilities: ['cashflow'],
      cashflowDigestEnabled: true,
    })
    await tx(m.id, 'EURC', '50000000', new Date(Date.UTC(2026, 8, 14, 12)))
    await t.app.get(CashflowDigestService).tick(new Date(Date.UTC(2026, 8, 15, 9)))
    expect(agentActivityLogSchema.safeParse(await activityRow(m.id)).success).toBe(true)
  })

  it('anomaly baseline of one currency is not lifted by the other', async () => {
    const m = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, m.id, { enabledCapabilities: ['cashflow'] })
    const hourStart = Date.UTC(2026, 8, 15, 9)
    for (let d = 1; d <= 10; d++) {
      await tx(
        m.id,
        'USDC',
        String(100_000_000 + d * 100_000),
        new Date(hourStart - d * 86_400_000 + 60_000),
      )
    }
    await tx(m.id, 'EURC', '100000000', new Date(hourStart + 60_000))

    const r = await t.app.get(CashflowAnomalyService).tick(new Date(hourStart + 3_600_000 + 60_000))
    expect(r.flagged).toBe(1)
  })

  it('yield compares only USDC with the USD reserve', async () => {
    const m = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, m.id, {
      enabledCapabilities: ['cashflow'],
      cashflowAutoConvertToYield: true,
      cashflowMinimumLiquidReserveCents: 100_000,
    })
    await tx(m.id, 'USDC', '600000000', new Date())
    await tx(m.id, 'EURC', '600000000', new Date())

    const r = await t.app.get(CashflowYieldService).tick()
    expect(r.recommended).toBe(0)
  })

  it('commerce reports spend per currency and caps only USDC', async () => {
    const m = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, m.id, {
      enabledCapabilities: ['commerce'],
      commerceMonthlySpendCapUsdCents: 100_000,
    })
    const august = new Date(Date.UTC(2026, 7, 15))
    for (const [currency, amount] of [
      ['USDC', '80000000'],
      ['EURC', '20000000'],
    ] as const) {
      await t.prisma.db.agentJob.create({
        data: {
          merchantId: m.id,
          vendorAddress: '0x' + 'a'.repeat(40),
          assessorAddress: '0x' + 'b'.repeat(40),
          description: 'spec',
          amount,
          currency,
          status: 'completed',
          createdAt: august,
        },
      })
    }

    await t.app.get(CommerceService).tick(new Date(Date.UTC(2026, 8, 1, 9)))
    const log = must(await t.prisma.db.agentActivityLog.findFirst({ where: { merchantId: m.id } }))
    const meta = log.metadata as Record<string, unknown>
    expect(meta.spendUsdc).toBe('80000000')
    expect(meta.spendEurc).toBe('20000000')
    expect(meta).not.toHaveProperty('totalSpendCents')
    expect(meta.capUtilisationPct).toBe(8)
    expect(agentActivityLogSchema.safeParse(await activityRow(m.id)).success).toBe(true)
    const html = must(t.email.sent[0]).html
    expect(html).toContain('80 USDC')
    expect(html).toContain('20 EURC')
  })

  it('pricing reports MRR per currency', async () => {
    const m = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, m.id, { enabledCapabilities: ['pricing_intelligence'] })
    const customer = await t.prisma.db.customer.create({
      data: { merchantId: m.id, walletAddress: '0x' + 'a'.repeat(40) },
    })
    for (const currency of ['USDC', 'EURC'] as const) {
      const plan = await t.prisma.db.subscriptionPlan.create({
        data: {
          merchantId: m.id,
          name: currency,
          amount: '20000000',
          currency,
          interval: 'monthly',
          intervalCount: 1,
        },
      })
      await t.prisma.db.subscription.create({
        data: {
          merchantId: m.id,
          customerId: customer.id,
          planId: plan.id,
          status: 'active',
          payerAddress: customer.walletAddress,
          currency,
          amount: '20000000',
          interval: 'monthly',
          intervalCount: 1,
          currentPeriodStartAt: new Date(),
          currentPeriodEndAt: new Date(Date.now() + 30 * 86_400_000),
          gracePeriodHours: 48,
          mode: 'live',
        },
      })
    }

    await t.app.get(PricingService).tick()
    const html = must(t.email.sent[0]).html
    expect(html).not.toContain('40 USDC')
    expect(html).toContain('20 USDC')
    expect(html).toContain('20 EURC')
  })
})
