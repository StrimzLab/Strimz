import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedAgentConfig, seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { CashflowDigestService } from '../../src/capabilities/cashflow/digest.service.js'

describe('cashflow digest e2e', () => {
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

  it("aggregates yesterday's confirmed transactions and emails the merchant", async () => {
    const merchant = await seedMerchant(t.prisma.db, { businessName: 'Acme Inc.' })
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowDigestEnabled: true,
    })

    // Yesterday at 12:00 UTC (so it falls inside the digest window).
    const yesterdayNoon = new Date()
    yesterdayNoon.setUTCDate(yesterdayNoon.getUTCDate() - 1)
    yesterdayNoon.setUTCHours(12, 0, 0, 0)

    await seedTransaction(t.prisma.db, merchant.id, {
      amount: '100000000',
      feeAmount: '1500000',
      netAmount: '98500000',
      blockTimestamp: yesterdayNoon,
    })
    await seedTransaction(t.prisma.db, merchant.id, {
      amount: '50000000',
      feeAmount: '750000',
      netAmount: '49250000',
      blockTimestamp: yesterdayNoon,
    })
    // Today's transactions — must not be included.
    await seedTransaction(t.prisma.db, merchant.id, {
      amount: '999999999',
      blockTimestamp: new Date(),
    })

    const result = await t.app.get(CashflowDigestService).tick()
    expect(result.sent).toBe(1)
    expect(t.email.sent).toHaveLength(1)
    expect(t.email.sent[0]!.subject).toMatch(/daily digest/)
    expect(t.email.sent[0]!.html).toContain('150') // 150 USDC revenue (humanised, no decimals)

    const log = await t.prisma.db.agentActivityLog.findFirst({
      where: { capability: 'cashflow', actionType: 'cashflow_digest_sent' },
    })
    expect(log).not.toBeNull()
    const meta = log!.metadata as Record<string, unknown>
    expect(meta.revenue).toBe('150000000')
    expect(meta.fees).toBe('2250000')
    expect(meta.net).toBe('147750000')
    expect(meta.count).toBe(2)
  })

  it('skips merchants with cashflowDigestEnabled=false', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowDigestEnabled: false,
    })
    const result = await t.app.get(CashflowDigestService).tick()
    expect(result.sent).toBe(0)
    expect(t.email.sent).toHaveLength(0)
  })

  it('is idempotent within the same UTC day', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['cashflow'],
      cashflowDigestEnabled: true,
    })

    const digest = t.app.get(CashflowDigestService)
    await digest.tick()
    t.email.reset()
    const second = await digest.tick()
    expect(second.skipped).toBe(1)
    expect(t.email.sent).toHaveLength(0)
  })
})
