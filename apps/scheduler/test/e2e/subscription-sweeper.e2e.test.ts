import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'
import { SubscriptionSweeperService } from '../../src/crons/subscription-sweeper/subscription-sweeper.service.js'
import { QUEUE_NAMES } from '../../src/infra/queue/queue-names.js'

describe('subscription sweeper e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    const queue: Queue = t.app.get(getQueueToken(QUEUE_NAMES.subscriptionDue))
    await queue.drain(true)
    // Pause the queue so the registered SubscriptionDueWorker doesn't pick
    // up jobs and release the chargeLock before our assertions run.
    await queue.pause()
  })

  afterEach(async () => {
    const queue: Queue = t.app.get(getQueueToken(QUEUE_NAMES.subscriptionDue))
    await queue.resume()
  })

  it('locks and enqueues only subscriptions that are due, active, and unlocked', async () => {
    const merchant = await seedMerchant(t.prisma.db)

    const dueActive = await seedSubscription(t.prisma.db, merchant.id, { onchainSubscriptionId: 1 })
    const dueAtRisk = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 2,
      status: 'at_risk',
    })
    // Not due yet — nextChargeAt in the future.
    await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 3,
      nextChargeAt: new Date(Date.now() + 86_400_000),
    })
    // Locked already.
    await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 4,
      chargeLock: true,
    })
    // Cancelled.
    await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 5,
      status: 'cancelled',
    })
    // Missing on-chain id.
    await seedSubscription(t.prisma.db, merchant.id, { onchainSubscriptionId: null })

    const sweeper = t.app.get(SubscriptionSweeperService)
    const result = await sweeper.sweepNow()
    expect(result.enqueued).toBe(2)

    const queue: Queue = t.app.get(getQueueToken(QUEUE_NAMES.subscriptionDue))
    const jobs = await queue.getJobs(['waiting', 'delayed', 'active'])
    expect(jobs).toHaveLength(2)
    const subIds = jobs.map((j) => (j.data as { subscriptionId: string }).subscriptionId).sort()
    expect(subIds).toEqual([dueActive.id, dueAtRisk.id].sort())

    // chargeLock is now true on those rows.
    const locked = await t.prisma.db.subscription.findMany({
      where: { id: { in: [dueActive.id, dueAtRisk.id] } },
    })
    expect(locked.every((s) => s.chargeLock)).toBe(true)
  })

  it('a second sweep tick does not re-pick already-locked subs', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedSubscription(t.prisma.db, merchant.id, { onchainSubscriptionId: 1 })

    const sweeper = t.app.get(SubscriptionSweeperService)
    const r1 = await sweeper.sweepNow()
    const r2 = await sweeper.sweepNow()
    expect(r1.enqueued).toBe(1)
    expect(r2.enqueued).toBe(0)
  })
})
