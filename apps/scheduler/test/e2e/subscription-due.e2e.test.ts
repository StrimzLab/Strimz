import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'
import {
  deriveChargeAttemptId,
  SubscriptionDueWorker,
} from '../../src/workers/subscription-due/subscription-due.worker.js'
import { must } from '../helpers/must.js'

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
    expect(result.chargeAttemptId).toBe(deriveChargeAttemptId(7, sub.currentPeriodEndAt, 0))

    const calls = t.chain.callsFor('batchCharge')
    expect(calls).toHaveLength(1)
    expect((must(calls[0]).args[0] as bigint[])[0]).toBe(7n)
    expect((must(calls[0]).args[1] as string[])[0]).toBe(result.chargeAttemptId)

    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it('charges with the next attempt id when the first one is already burned', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })
    const first = deriveChargeAttemptId(7, sub.currentPeriodEndAt, 0)
    const second = deriveChargeAttemptId(7, sub.currentPeriodEndAt, 1)
    t.chain.attemptUsedAnswers.set(first, true)

    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)

    expect(second).not.toBe(first)
    expect(result.chargeAttemptId).toBe(second)
    const calls = t.chain.callsFor('batchCharge')
    expect(calls).toHaveLength(1)
    expect((must(calls[0]).args[1] as string[])[0]).toBe(second)
  })

  it('skips broadcast when the contract says the charge is not due', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })
    t.chain.chargeDueAnswers.set(7n, false)

    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)

    expect(result).toEqual({ txHash: '0xnotdue', chargeAttemptId: '0x0' })
    expect(t.chain.callsFor('batchCharge')).toHaveLength(0)
    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it.each(['cancelled', 'lapsed'] as const)(
    'skips broadcast for a %s subscription',
    async (status) => {
      const merchant = await seedMerchant(t.prisma.db)
      const sub = await seedSubscription(t.prisma.db, merchant.id, {
        onchainSubscriptionId: 7,
        chargeLock: true,
        status,
      })

      const worker = t.app.get(SubscriptionDueWorker)
      const result = await worker.process({ data: { subscriptionId: sub.id } } as never)

      expect(result).toEqual({ txHash: '0x0', chargeAttemptId: '0x0' })
      expect(t.chain.callsFor('batchCharge')).toHaveLength(0)
      const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
      expect(updated.chargeLock).toBe(false)
    },
  )

  it('skips broadcast when every attempt id for the period is already used', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })

    // Pre-seed the stub: any attempt id query returns true.
    t.chain.attemptUsedDefault = true
    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)
    expect(result).toEqual({ txHash: '0xexhausted', chargeAttemptId: '0x0' })
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
