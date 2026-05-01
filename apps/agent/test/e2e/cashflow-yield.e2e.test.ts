import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedAgentConfig, seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { CashflowYieldService } from '../../src/capabilities/cashflow/yield-recommendation.service.js'

describe('cashflow yield recommendation e2e', () => {
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

  it('emails when running net balance exceeds the configured reserve', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowAutoConvertToYield: true,
      cashflowMinimumLiquidReserveCents: 50_000, // $500 reserve
    })
    // 1000 USDC net → 100,000 cents
    await seedTransaction(t.prisma.db, merchant.id, {
      amount: '1000000000',
      netAmount: '1000000000',
    })

    const result = await t.app.get(CashflowYieldService).tick()
    expect(result.recommended).toBe(1)
    expect(t.email.sent).toHaveLength(1)
    expect(t.email.sent[0]!.subject).toContain('yield')
    expect(t.email.sent[0]!.html).toContain('500.00') // $500 surplus

    const log = await t.prisma.db.agentActivityLog.findFirst({
      where: { capability: 'cashflow', actionType: 'cashflow_yield_converted' },
    })
    expect(log).not.toBeNull()
    expect(log!.outcome).toBe('pending')
    const meta = log!.metadata as Record<string, unknown>
    expect(meta.surplusCents).toBe(50_000)
    expect(meta.stage).toBe('recommendation_sent')
  })

  it('skips when balance is below reserve', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowAutoConvertToYield: true,
      cashflowMinimumLiquidReserveCents: 1_000_000, // $10,000 reserve
    })
    await seedTransaction(t.prisma.db, merchant.id, { netAmount: '50000000' })

    const result = await t.app.get(CashflowYieldService).tick()
    expect(result.recommended).toBe(0)
    expect(t.email.sent).toHaveLength(0)
  })

  it('skips merchants with autoConvertToYield=false even with surplus', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowAutoConvertToYield: false,
      cashflowMinimumLiquidReserveCents: 50_000,
    })
    await seedTransaction(t.prisma.db, merchant.id, { netAmount: '1000000000' })

    const result = await t.app.get(CashflowYieldService).tick()
    expect(result.recommended).toBe(0)
  })

  it('is idempotent within 23h', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowAutoConvertToYield: true,
      cashflowMinimumLiquidReserveCents: 0,
    })
    await seedTransaction(t.prisma.db, merchant.id, { netAmount: '1000000000' })

    const yieldRec = t.app.get(CashflowYieldService)
    await yieldRec.tick()
    t.email.reset()
    const second = await yieldRec.tick()
    expect(second.skipped).toBe(1)
    expect(t.email.sent).toHaveLength(0)
  })
})
