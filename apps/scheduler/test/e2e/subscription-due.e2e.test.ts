import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'
import { SubscriptionDueWorker } from '../../src/workers/subscription-due/subscription-due.worker.js'

describe('subscription-due worker e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.chain.reset()
  })

  it('signs batchCharge with derived attempt id, releases lock, returns tx hash', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })

    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)
    expect(result.txHash).toMatch(/^0x/)
    expect(result.chargeAttemptId).toMatch(/^0x[0-9a-f]{64}$/)

    const calls = t.chain.callsFor('batchCharge')
    expect(calls).toHaveLength(1)
    expect((calls[0]!.args[0] as bigint[])[0]).toBe(7n)

    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it('skips broadcast when contract reports the attempt id is already used', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })

    // Pre-seed the stub: any attempt id query returns true.
    t.chain.attemptUsedDefault = true
    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)
    expect(result.txHash).toBe('0xused')
    expect(t.chain.callsFor('batchCharge')).toHaveLength(0)

    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it('releases lock and rethrows when broadcast fails', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })

    t.chain.failNext = true
    const worker = t.app.get(SubscriptionDueWorker)
    await expect(worker.process({ data: { subscriptionId: sub.id } } as never)).rejects.toThrow(
      /failNext/,
    )

    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it('skips when subscription has no on-chain id (indexer not caught up)', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: null,
      chargeLock: true,
    })

    const worker = t.app.get(SubscriptionDueWorker)
    await expect(worker.process({ data: { subscriptionId: sub.id } } as never)).rejects.toThrow(
      /onchainSubscriptionId/,
    )
    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })
})
