import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedDelivery,
  seedMerchant,
  seedWebhookEndpoint,
  seedWebhookEvent,
} from '../helpers/fixtures.js'
import { WebhookRecoveryService } from '../../src/crons/webhook-recovery/webhook-recovery.service.js'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { must } from '../helpers/must.js'

describe('webhook recovery cron e2e', () => {
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

  async function seedStranded(opts: {
    ageMs: number
    endpointStatus?: 'active' | 'disabled'
    nextAttemptAt?: Date | null
    status?: 'pending' | 'retrying'
  }) {
    const merchant = await seedMerchant(t.prisma.db)
    const { endpoint } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/h',
      events: ['payment_completed'],
    })
    if (opts.endpointStatus === 'disabled') {
      await t.prisma.db.merchantWebhookEndpoint.update({
        where: { id: endpoint.id },
        data: { status: 'disabled' },
      })
    }
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')
    const delivery = await seedDelivery(
      t.prisma.db,
      merchant.id,
      endpoint.id,
      event.id,
      'payment_completed',
    )
    await t.prisma.db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        createdAt: new Date(Date.now() - opts.ageMs),
        nextAttemptAt: opts.nextAttemptAt ?? null,
        status: opts.status ?? 'pending',
      },
    })
    return delivery
  }

  async function queuedDeliveryIds(): Promise<string[]> {
    const q: Queue = t.app.get(getQueueToken(QUEUE_NAMES.webhookDelivery))
    const jobs = await q.getJobs(['waiting', 'delayed', 'active'])
    return jobs.map((j) => (j.data as { deliveryId: string }).deliveryId)
  }

  it('leaves a delivery alone until it has been pending long enough to count as stranded', async () => {
    await seedStranded({ ageMs: 10_000 })
    const cron = t.app.get(WebhookRecoveryService)
    expect(await cron.sweepNow()).toEqual({ requeued: 0 })
    expect(await queuedDeliveryIds()).toEqual([])
  })

  it('re-queues a pending delivery that never got its job', async () => {
    const delivery = await seedStranded({ ageMs: 10 * 60_000 })
    const cron = t.app.get(WebhookRecoveryService)
    expect(await cron.sweepNow()).toEqual({ requeued: 1 })
    expect(await queuedDeliveryIds()).toEqual([delivery.id])

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(must(updated.nextAttemptAt).getTime()).toBeGreaterThan(Date.now())

    expect(await cron.sweepNow()).toEqual({ requeued: 0 })
  })

  it('re-queues a retry whose delayed job is overdue', async () => {
    const delivery = await seedStranded({
      ageMs: 30 * 60_000,
      status: 'retrying',
      nextAttemptAt: new Date(Date.now() - 5 * 60_000),
    })
    const cron = t.app.get(WebhookRecoveryService)
    expect(await cron.sweepNow()).toEqual({ requeued: 1 })
    expect(await queuedDeliveryIds()).toEqual([delivery.id])
  })

  it('does not re-queue deliveries for a disabled endpoint', async () => {
    await seedStranded({ ageMs: 10 * 60_000, endpointStatus: 'disabled' })
    const cron = t.app.get(WebhookRecoveryService)
    expect(await cron.sweepNow()).toEqual({ requeued: 0 })
    expect(await queuedDeliveryIds()).toEqual([])
  })
})
