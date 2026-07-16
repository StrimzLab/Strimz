import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription, seedWebhookEndpoint } from '../helpers/fixtures.js'
import { SubscriptionLapsedService } from '../../src/crons/subscription-lapsed/subscription-lapsed.service.js'
import { WebhookOutboxService } from '../../src/infra/webhook-outbox/webhook-outbox.service.js'
import { QUEUE_NAMES } from '../../src/infra/queue/queue-names.js'

describe('subscription-lapsed cron e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    const q: Queue = t.app.get(getQueueToken(QUEUE_NAMES.webhookDelivery))
    await q.drain(true)
  })

  it('flips at_risk subs whose grace window has expired and fires subscription.lapsed', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/h',
      events: ['subscription_lapsed'],
      mode: 'test',
    })

    // grace window EXPIRED — currentPeriodEndAt + gracePeriodHours hours < now.
    const expiredSub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 1,
      status: 'at_risk',
    })
    // The seedSubscription helper sets currentPeriodEndAt = now + 30d. We
    // need it in the past, so manually override here.
    await t.prisma.db.subscription.update({
      where: { id: expiredSub.id },
      data: {
        currentPeriodStartAt: new Date(Date.now() - 60 * 24 * 60 * 60_000), // 60d ago
        currentPeriodEndAt: new Date(Date.now() - 7 * 24 * 60 * 60_000), // 7d ago
        gracePeriodHours: 48, // 48h grace
      },
    })

    // Same merchant, status=at_risk, but grace window NOT yet expired.
    const stillInGrace = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 2,
      status: 'at_risk',
    })
    await t.prisma.db.subscription.update({
      where: { id: stillInGrace.id },
      data: {
        currentPeriodEndAt: new Date(Date.now() - 60 * 60_000), // 1 hour ago
        gracePeriodHours: 48,
      },
    })

    // Active sub — must not be touched.
    await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 3,
      status: 'active',
    })

    const cron = t.app.get(SubscriptionLapsedService)
    const result = await cron.sweepNow()
    expect(result.flipped).toBe(1)

    const states = await t.prisma.db.subscription.findMany({
      orderBy: { onchainSubscriptionId: 'asc' },
      select: { onchainSubscriptionId: true, status: true },
    })
    expect(states).toEqual([
      { onchainSubscriptionId: 1, status: 'lapsed' },
      { onchainSubscriptionId: 2, status: 'at_risk' },
      { onchainSubscriptionId: 3, status: 'active' },
    ])

    const events = await t.prisma.db.webhookEvent.findMany({
      where: { type: 'subscription_lapsed' },
    })
    expect(events).toHaveLength(1)
    expect(events[0]!.dispatchedAt).toBeNull()

    const outbox = t.app.get(WebhookOutboxService)
    const dispatched = await outbox.tickNow()
    expect(dispatched.deliveriesQueued).toBe(1)

    const deliveries = await t.prisma.db.webhookDelivery.findMany()
    expect(deliveries).toHaveLength(1)
  })

  it('returns 0 when nothing has aged past grace', async () => {
    const cron = t.app.get(SubscriptionLapsedService)
    const result = await cron.sweepNow()
    expect(result).toEqual({ flipped: 0 })
  })
})
