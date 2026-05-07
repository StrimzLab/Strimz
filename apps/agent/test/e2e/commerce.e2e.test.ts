import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedAgentConfig, seedAgentJob, seedMerchant } from '../helpers/fixtures.js'
import { CommerceService } from '../../src/capabilities/commerce/commerce.service.js'

describe('commerce monthly summary e2e', () => {
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

  it("aggregates last month's vendor activity and emails the merchant", async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['commerce'],
      commerceMonthlySpendCapUsdCents: 100_000, // $1000 cap
    })

    const lastMonth = new Date()
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1)
    lastMonth.setUTCDate(15)

    await seedAgentJob(t.prisma.db, merchant.id, {
      vendorAddress: '0x' + 'a'.repeat(40),
      amount: '50000000',
      status: 'completed',
      createdAt: lastMonth,
    })
    await seedAgentJob(t.prisma.db, merchant.id, {
      vendorAddress: '0x' + 'b'.repeat(40),
      amount: '30000000',
      status: 'approved',
      createdAt: lastMonth,
    })
    // Proposed (awaiting approval) — should be flagged in summary but not in spend.
    await seedAgentJob(t.prisma.db, merchant.id, {
      vendorAddress: '0x' + 'c'.repeat(40),
      amount: '5000000',
      status: 'proposed',
      createdAt: lastMonth,
    })

    const result = await t.app.get(CommerceService).tick()
    expect(result.sent).toBe(1)
    expect(t.email.sent).toHaveLength(1)
    const html = t.email.sent[0]!.html
    expect(html).toContain('1 job(s)') // proposed count
    expect(html).toContain('80.00') // $80 spent

    const log = await t.prisma.db.agentActivityLog.findFirst({
      where: { capability: 'commerce', actionType: 'commerce_job_completed' },
    })
    const meta = log!.metadata as Record<string, unknown>
    expect(meta.stage).toBe('monthly_summary')
    expect(meta.totalSpendCents).toBe(8_000)
    expect(meta.capUtilisationPct).toBe(8) // 80 / 1000 = 8%
  })

  it('skips merchants without commerce enabled', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, { enabledCapabilities: [] })

    const result = await t.app.get(CommerceService).tick()
    expect(result.sent).toBe(0)
    expect(t.email.sent).toHaveLength(0)
  })

  it('handles merchants with no jobs in the prior month', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, { enabledCapabilities: ['commerce'] })

    const result = await t.app.get(CommerceService).tick()
    expect(result.sent).toBe(1)
    expect(t.email.sent[0]!.html).toContain('No vendor activity')
  })
})
