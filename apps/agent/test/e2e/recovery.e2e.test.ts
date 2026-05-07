import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedAgentConfig, seedMerchant, seedSubscription } from '../helpers/fixtures.js'
import { RecoveryService } from '../../src/capabilities/recovery/recovery.service.js'

describe('recovery e2e', () => {
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

  it("skips merchants that don't have recovery in enabledCapabilities", async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, { enabledCapabilities: [] })
    await seedSubscription(t.prisma.db, merchant.id, { status: 'at_risk' })

    const result = await t.app.get(RecoveryService).tick()
    expect(result.notified).toBe(0)
    expect(t.email.sent).toHaveLength(0)
  })

  it('sends one notification per at_risk sub when strategy=once', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['recovery'],
      recoveryStrategy: 'once',
    })
    await seedSubscription(t.prisma.db, merchant.id, {
      status: 'at_risk',
      customerEmail: 'buyer@x.test',
      currentPeriodEndAt: new Date(Date.now() - 60_000), // due now
    })

    const result = await t.app.get(RecoveryService).tick()
    expect(result.notified).toBe(1)
    expect(t.email.sent).toHaveLength(1)
    expect(t.email.sent[0]!.to).toBe('buyer@x.test')
    expect(t.email.sent[0]!.subject).toContain('Action needed')

    const logs = await t.prisma.db.agentActivityLog.findMany({
      where: { capability: 'recovery', actionType: 'recovery_notification_sent' },
    })
    expect(logs).toHaveLength(1)
    expect(logs[0]!.outcome).toBe('success')
  })

  it('deduplicates a second tick within 23h', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['recovery'],
      recoveryStrategy: 'once',
    })
    await seedSubscription(t.prisma.db, merchant.id, {
      status: 'at_risk',
      customerEmail: 'buyer@x.test',
      currentPeriodEndAt: new Date(Date.now() - 60_000),
    })

    const recovery = t.app.get(RecoveryService)
    await recovery.tick()
    t.email.reset()
    const second = await recovery.tick()
    expect(second.notified).toBe(0)
    expect(second.skipped).toBe(1)
    expect(t.email.sent).toHaveLength(0)
  })

  it('records recovery_abandoned when customer has no email', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, { enabledCapabilities: ['recovery'] })

    // Manually seed a sub whose customer has no email.
    const customer = await t.prisma.db.customer.create({
      data: { merchantId: merchant.id, walletAddress: '0x' + 'a'.repeat(40), email: null },
    })
    const plan = await t.prisma.db.subscriptionPlan.create({
      data: {
        merchantId: merchant.id,
        name: 'Plan',
        amount: '1',
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
        status: 'at_risk',
        payerAddress: customer.walletAddress,
        currency: 'USDC',
        amount: '1',
        interval: 'monthly',
        intervalCount: 1,
        currentPeriodStartAt: new Date(Date.now() - 86_400_000),
        currentPeriodEndAt: new Date(Date.now() - 60_000),
        gracePeriodHours: 48,
        mode: 'test',
      },
    })

    const result = await t.app.get(RecoveryService).tick()
    expect(result.notified).toBe(0)
    expect(result.skipped).toBe(1)
    expect(t.email.sent).toHaveLength(0)

    const abandoned = await t.prisma.db.agentActivityLog.findFirst({
      where: { capability: 'recovery', actionType: 'recovery_abandoned' },
    })
    expect(abandoned).not.toBeNull()
  })

  it('respects strategy=until_grace_ends — schedules 3 attempts at 0/24h/72h', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedAgentConfig(t.prisma.db, merchant.id, {
      enabledCapabilities: ['recovery'],
      recoveryStrategy: 'until_grace_ends',
    })
    // Period ended 73 hours ago — all three offsets crossed.
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      status: 'at_risk',
      customerEmail: 'late@x.test',
      currentPeriodEndAt: new Date(Date.now() - 73 * 60 * 60_000),
    })
    const recovery = t.app.get(RecoveryService)

    // First tick → notification (attempt 3 of 3 since latest crossed offset is index 2).
    const first = await recovery.tick()
    expect(first.notified).toBe(1)
    const logs = await t.prisma.db.agentActivityLog.findMany({
      where: { subscriptionId: sub.id, capability: 'recovery' },
      orderBy: { createdAt: 'asc' },
    })
    expect(logs).toHaveLength(1)
    const meta = logs[0]!.metadata as Record<string, unknown>
    expect(meta.totalAttempts).toBe(3)
    expect(meta.attemptNumber).toBe(3)
  })
})
