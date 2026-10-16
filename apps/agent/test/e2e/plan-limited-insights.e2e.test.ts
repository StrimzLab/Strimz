import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedAgentConfig, seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { CashflowAnomalyService } from '../../src/capabilities/cashflow/anomaly.service.js'
import { CashflowYieldService } from '../../src/capabilities/cashflow/yield-recommendation.service.js'

describe('agent insights follow the merchant plan', () => {
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

  async function seedAnomalousHour(tier: 'free' | 'starter') {
    const merchant = await seedMerchant(t.prisma.db, { tier })
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowAnomalySensitivity: 'medium',
    })
    const baselineHour = new Date()
    baselineHour.setUTCMinutes(0, 0, 0)
    baselineHour.setUTCHours(baselineHour.getUTCHours() - 1)
    for (let i = 1; i <= 10; i++) {
      const dayBack = new Date(baselineHour)
      dayBack.setUTCDate(dayBack.getUTCDate() - i)
      await seedTransaction(t.prisma.db, merchant.id, {
        amount: String(100_000_000 + i * 100_000),
        netAmount: String(100_000_000 + i * 100_000),
        blockTimestamp: dayBack,
      })
    }
    return merchant
  }

  async function seedYieldSurplus(tier: 'free' | 'starter') {
    const merchant = await seedMerchant(t.prisma.db, { tier })
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowAutoConvertToYield: true,
      cashflowMinimumLiquidReserveCents: 50_000,
    })
    await seedTransaction(t.prisma.db, merchant.id, {
      amount: '1000000000',
      netAmount: '1000000000',
    })
    return merchant
  }

  it('does not check a Free merchant for anomalies', async () => {
    await seedAnomalousHour('free')

    const result = await t.app.get(CashflowAnomalyService).tick()

    expect(result).toEqual({ flagged: 0, checked: 0 })
    expect(t.email.sent).toHaveLength(0)
  })

  it('checks only the Starter merchant when both have an anomalous hour', async () => {
    await seedAnomalousHour('free')
    const starter = await seedAnomalousHour('starter')

    const result = await t.app.get(CashflowAnomalyService).tick()

    expect(result.flagged).toBe(1)
    const flagged = await t.prisma.db.agentActivityLog.findMany({
      where: { actionType: 'cashflow_anomaly_flagged' },
      select: { merchantId: true },
    })
    expect(flagged).toEqual([{ merchantId: starter.id }])
  })

  it('sends no yield recommendation to a Free merchant', async () => {
    await seedYieldSurplus('free')

    const result = await t.app.get(CashflowYieldService).tick()

    expect(result).toEqual({ recommended: 0, skipped: 0 })
    expect(t.email.sent).toHaveLength(0)
  })

  it('sends the yield recommendation to a Starter merchant', async () => {
    await seedYieldSurplus('starter')

    const result = await t.app.get(CashflowYieldService).tick()

    expect(result.recommended).toBe(1)
    expect(t.email.sent).toHaveLength(1)
  })
})
