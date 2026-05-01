import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedAgentConfig, seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { CashflowAnomalyService } from '../../src/capabilities/cashflow/anomaly.service.js'

describe('cashflow anomaly e2e', () => {
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

  it('skips when fewer than 7 prior data points exist', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, { enabledCapabilities: ['cashflow'] })
    await seedTransaction(t.prisma.db, merchant.id, { blockTimestamp: new Date() })

    const result = await t.app.get(CashflowAnomalyService).tick()
    expect(result.flagged).toBe(0)
    expect(t.email.sent).toHaveLength(0)
  })

  it('flags an hour with revenue many σ below the 30-day mean for that hour', async () => {
    const merchant = await seedMerchant(t.prisma.db, { businessName: 'Anomaly Co' })
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowAnomalySensitivity: 'medium',
    })

    // Build a 30-day baseline: 10 prior days, same hour-of-day, with ~100 USDC rev each.
    const baselineHour = new Date()
    baselineHour.setUTCMinutes(0, 0, 0)
    baselineHour.setUTCHours(baselineHour.getUTCHours() - 1)
    for (let i = 1; i <= 10; i++) {
      const dayBack = new Date(baselineHour)
      dayBack.setUTCDate(dayBack.getUTCDate() - i)
      // Slight noise so stddev > 0.
      await seedTransaction(t.prisma.db, merchant.id, {
        amount: String(100_000_000 + i * 100_000),
        netAmount: String(100_000_000 + i * 100_000),
        blockTimestamp: dayBack,
      })
    }

    // Last hour has zero revenue — clearly anomalous.
    const result = await t.app.get(CashflowAnomalyService).tick()
    expect(result.flagged).toBe(1)
    expect(t.email.sent).toHaveLength(1)
    expect(t.email.sent[0]!.subject).toMatch(/anomaly/)

    const audit = await t.prisma.db.auditLog.findMany({
      where: { merchantId: merchant.id, action: 'cashflow.anomaly_detected' },
    })
    expect(audit).toHaveLength(1)
  })

  it('does NOT flag a revenue surge', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, { enabledCapabilities: ['cashflow'] })

    const baselineHour = new Date()
    baselineHour.setUTCMinutes(0, 0, 0)
    baselineHour.setUTCHours(baselineHour.getUTCHours() - 1)
    // 10 prior small days.
    for (let i = 1; i <= 10; i++) {
      const dayBack = new Date(baselineHour)
      dayBack.setUTCDate(dayBack.getUTCDate() - i)
      await seedTransaction(t.prisma.db, merchant.id, {
        amount: String(10_000_000 + i * 100_000),
        netAmount: String(10_000_000 + i * 100_000),
        blockTimestamp: dayBack,
      })
    }
    // Surge: last hour is 100x the typical hour.
    await seedTransaction(t.prisma.db, merchant.id, {
      amount: '1000000000',
      blockTimestamp: new Date(baselineHour.getTime() + 60_000),
    })

    const result = await t.app.get(CashflowAnomalyService).tick()
    expect(result.flagged).toBe(0)
    expect(t.email.sent).toHaveLength(0)
  })
})
