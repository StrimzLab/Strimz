import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription, seedWebhookEndpoint } from '../helpers/fixtures.js'
import { WebhookOutboxService } from '../../src/infra/webhook-outbox/webhook-outbox.service.js'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { must } from '../helpers/must.js'

describe('webhook outbox dispatcher e2e', () => {
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

  function seedRefEvent(merchantId: string, ref: Record<string, unknown>, id: string) {
    return t.prisma.db.webhookEvent.create({
      data: {
        id,
        merchantId,
        type: 'subscription_lapsed' as never,
        apiVersion: '2026-04-27',
        mode: 'test',
        payload: { ref } as never,
      },
    })
  }

  it('queues one delivery per active endpoint subscribed to the event in the same mode', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const other = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'lapsed' })

    const subscribed = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/subscribed',
      events: ['subscription_lapsed'],
    })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/other-event',
      events: ['payment_completed'],
    })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/live-mode',
      events: ['subscription_lapsed'],
      mode: 'live',
    })
    const disabled = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/disabled',
      events: ['subscription_lapsed'],
    })
    await t.prisma.db.merchantWebhookEndpoint.update({
      where: { id: disabled.endpoint.id },
      data: { status: 'disabled' },
    })
    await seedWebhookEndpoint(t.prisma.db, other.id, {
      url: 'https://example.com/other-merchant',
      events: ['subscription_lapsed'],
    })

    await seedRefEvent(
      merchant.id,
      { kind: 'subscription.lapsed', subscriptionId: sub.id },
      'evt_outbox_1',
    )

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 1 })

    const deliveries = await t.prisma.db.webhookDelivery.findMany()
    expect(deliveries).toHaveLength(1)
    const delivery = must(deliveries[0])
    expect(delivery.endpointId).toBe(subscribed.endpoint.id)
    expect(delivery.eventId).toBe('evt_outbox_1')
    expect(delivery.status).toBe('pending')
    expect(delivery.attempt).toBe(1)

    const event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_outbox_1' },
    })
    expect(event.dispatchedAt).not.toBeNull()
    expect(event.dispatchError).toBeNull()
    expect(event.payload).toMatchObject({
      id: 'evt_outbox_1',
      type: 'subscription.lapsed',
      mode: 'test',
      data: { id: sub.id },
    })

    const q: Queue = t.app.get(getQueueToken(QUEUE_NAMES.webhookDelivery))
    const queued = await q.getJobs(['waiting', 'delayed', 'active'])
    expect(queued).toHaveLength(1)
    expect(must(queued[0]).data).toMatchObject({
      deliveryId: delivery.id,
      endpointId: subscribed.endpoint.id,
      eventId: 'evt_outbox_1',
    })
  })

  it('does not dispatch the same event twice', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'lapsed' })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/h',
      events: ['subscription_lapsed'],
    })
    await seedRefEvent(
      merchant.id,
      { kind: 'subscription.lapsed', subscriptionId: sub.id },
      'evt_outbox_2',
    )

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 1 })
    expect(await outbox.tickNow()).toEqual({ dispatched: 0, deliveriesQueued: 0 })
    expect(await t.prisma.db.webhookDelivery.count()).toBe(1)
  })

  async function seedChargedEvent(
    merchantId: string,
    merchantAddress: string,
    eventId: string,
    hexDigit: string,
  ) {
    const sub = await seedSubscription(t.prisma.db, merchantId)
    const charge = await t.prisma.db.subscriptionCharge.create({
      data: {
        subscriptionId: sub.id,
        merchantId,
        chargeAttemptId: `0x${hexDigit.repeat(64)}`,
        periodStartAt: new Date(),
        periodEndAt: new Date(Date.now() + 30 * 86_400_000),
        amount: '20000000',
        currency: 'USDC',
        status: 'succeeded',
        outcome: 'charged',
        scheduledAt: new Date(),
        executedAt: new Date(),
      },
    })
    const tx = await t.prisma.db.transaction.create({
      data: {
        merchantId,
        kind: 'subscription_charge',
        status: 'confirmed',
        subscriptionId: sub.id,
        subscriptionChargeId: charge.id,
        amount: '20000000',
        feeAmount: '300000',
        netAmount: '19700000',
        currency: 'USDC',
        payerAddress: '0x' + 'a'.repeat(40),
        merchantAddress,
        onchainTxHash: `0x${hexDigit.repeat(63)}1`,
        blockNumber: 1n,
        blockTimestamp: new Date(),
        logIndex: 0,
        mode: 'test',
      },
    })
    await t.prisma.db.webhookEvent.create({
      data: {
        id: eventId,
        merchantId,
        type: 'subscription_charged' as never,
        apiVersion: '2026-04-27',
        mode: 'test',
        payload: {
          ref: {
            kind: 'subscription.charged',
            subscriptionId: sub.id,
            chargeId: charge.id,
            transactionId: tx.id,
          },
        } as never,
      },
    })
  }

  it('dispatches subscription.charged when the transaction carries the merchant address', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/h',
      events: ['subscription_charged'],
    })
    await seedChargedEvent(merchant.id, '0x' + 'b'.repeat(40), 'evt_charged_ok', 'c')

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 1 })
    const event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_charged_ok' },
    })
    expect(event.dispatchError).toBeNull()
  })

  it('records a dispatch error for subscription.charged when the merchant address is empty', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/h',
      events: ['subscription_charged'],
    })
    await seedChargedEvent(merchant.id, '', 'evt_charged_bad', 'd')

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 0 })
    const event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_charged_bad' },
    })
    expect(event.dispatchError).toContain('merchantAddress')
  })

  it.each([
    ['an unknown kind', { kind: 'payout.sent', payoutId: 'p_1' }],
    ['a missing id', { kind: 'subscription.lapsed' }],
    ['a row that does not exist', { kind: 'subscription.lapsed', subscriptionId: 'sub_missing' }],
  ])('records a dispatch error for a reference with %s', async (_label, ref) => {
    const merchant = await seedMerchant(t.prisma.db)
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/h',
      events: ['subscription_lapsed'],
    })
    await seedRefEvent(merchant.id, ref, 'evt_outbox_bad')

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 0 })

    const event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_outbox_bad' },
    })
    expect(event.dispatchError).toBeTruthy()
    expect(await t.prisma.db.webhookDelivery.count()).toBe(0)

    expect(await outbox.tickNow()).toEqual({ dispatched: 0, deliveriesQueued: 0 })
  })
})
