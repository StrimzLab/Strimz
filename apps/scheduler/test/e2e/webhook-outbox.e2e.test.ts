import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedMerchant,
  seedSubscription,
  seedTransaction,
  seedWebhookEndpoint,
} from '../helpers/fixtures.js'
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
    await q.resume()
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

  it('builds subscription.recovery_attempt from the ref the agent writes', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'at_risk' })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/recovery',
      events: ['subscription_recovery_attempt'],
    })
    await t.prisma.db.webhookEvent.create({
      data: {
        id: 'evt_recovery_1',
        merchantId: merchant.id,
        type: 'subscription_recovery_attempt',
        apiVersion: '2026-04-27',
        mode: 'test',
        payload: {
          ref: { kind: 'subscription.recovery_attempt', subscriptionId: sub.id, attemptNumber: 2 },
        },
      },
    })

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 1 })
    const event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_recovery_1' },
    })
    expect(event.dispatchError).toBeNull()
    expect(event.payload).toMatchObject({
      type: 'subscription.recovery_attempt',
      data: { subscription: { id: sub.id }, attemptNumber: 2 },
    })
  })

  it('builds subscription.reactivated from the ref the indexer writes on a reinstate', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'active' })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/reactivated',
      events: ['subscription_reactivated'],
    })
    await t.prisma.db.webhookEvent.create({
      data: {
        id: 'evt_reactivated_1',
        merchantId: merchant.id,
        type: 'subscription_reactivated',
        apiVersion: '2026-04-27',
        mode: 'test',
        payload: { ref: { kind: 'subscription.reactivated', subscriptionId: sub.id } },
      },
    })

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 1 })
    const event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_reactivated_1' },
    })
    expect(event.dispatchError).toBeNull()
    expect(event.payload).toMatchObject({
      type: 'subscription.reactivated',
      data: { id: sub.id, status: 'active' },
    })
  })

  it('builds subscription.cancelled, with who cancelled, from the ref the indexer writes', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'active' })
    await t.prisma.db.subscription.update({
      where: { id: sub.id },
      data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: 'payer' },
    })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/cancelled',
      events: ['subscription_cancelled'],
    })
    await t.prisma.db.webhookEvent.create({
      data: {
        id: 'evt_cancelled_1',
        merchantId: merchant.id,
        type: 'subscription_cancelled',
        apiVersion: '2026-04-27',
        mode: 'test',
        payload: { ref: { kind: 'subscription.cancelled', subscriptionId: sub.id } },
      },
    })

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 1 })
    const event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_cancelled_1' },
    })
    expect(event.dispatchError).toBeNull()
    expect(event.payload).toMatchObject({
      type: 'subscription.cancelled',
      data: { id: sub.id, status: 'cancelled', cancelledBy: 'payer' },
    })
  })

  // ADR-2026-11-13-refund-failures (#440).
  it('builds refund.failed with the refund and its failure reason', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const tx = await seedTransaction(t.prisma.db, merchant.id)
    const refund = await t.prisma.db.refund.create({
      data: {
        merchantId: merchant.id,
        transactionId: tx.id,
        amount: '500000',
        currency: 'USDC',
        reason: 'customer_request',
        status: 'failed',
        failureReason: 'transaction was replaced or dropped',
        payerAddress: '0x000000000000000000000000000000000000cafe',
        refundTxHash: `0x${'d'.repeat(64)}`,
        initiatedById: merchant.id,
      },
    })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/refund-failed',
      events: ['refund_failed'],
    })
    await t.prisma.db.webhookEvent.create({
      data: {
        id: 'evt_refund_failed_1',
        merchantId: merchant.id,
        type: 'refund_failed',
        apiVersion: '2026-04-27',
        mode: 'test',
        payload: { ref: { kind: 'refund.failed', refundId: refund.id } },
      },
    })

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 1 })
    const event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_refund_failed_1' },
    })
    expect(event.dispatchError).toBeNull()
    expect(event.payload).toMatchObject({
      type: 'refund.failed',
      data: {
        id: refund.id,
        status: 'failed',
        failureReason: 'transaction was replaced or dropped',
      },
    })
  })

  it('commits no claim while the event is still being hydrated, so a crash there loses nothing', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'lapsed' })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/hook',
      events: ['subscription_lapsed'],
    })
    await seedRefEvent(
      merchant.id,
      { kind: 'subscription.lapsed', subscriptionId: sub.id },
      'evt_mid_dispatch',
    )

    const outbox = t.app.get(WebhookOutboxService)
    const target = outbox as unknown as { hydrate: (ref: unknown) => Promise<unknown> }
    const realHydrate = target.hydrate.bind(outbox)
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    let entered!: () => void
    const hydrating = new Promise<void>((resolve) => (entered = resolve))
    const spy = vi.spyOn(target, 'hydrate').mockImplementationOnce(async (ref) => {
      entered()
      await released
      return realHydrate(ref)
    })

    const tick = outbox.tickNow()
    await hydrating
    const midway = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_mid_dispatch' },
    })
    release()
    expect(await tick).toEqual({ dispatched: 1, deliveriesQueued: 1 })
    spy.mockRestore()

    expect(midway.dispatchedAt).toBeNull()
    expect(
      await t.prisma.db.webhookDelivery.count({ where: { eventId: 'evt_mid_dispatch' } }),
    ).toBe(1)
  })

  it('leaves a fresh claim to the scheduler that holds it', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'lapsed' })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/hook',
      events: ['subscription_lapsed'],
    })
    await seedRefEvent(
      merchant.id,
      { kind: 'subscription.lapsed', subscriptionId: sub.id },
      'evt_in_flight',
    )
    await t.prisma.db.webhookEvent.update({
      where: { id: 'evt_in_flight' },
      data: { dispatchedAt: new Date() },
    })

    const outbox = t.app.get(WebhookOutboxService)
    expect(await outbox.tickNow()).toEqual({ dispatched: 0, deliveriesQueued: 0 })
    expect(await t.prisma.db.webhookDelivery.count({ where: { eventId: 'evt_in_flight' } })).toBe(0)
  })

  it('two dispatchers ticking at once deliver every event once', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'lapsed' })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/hook',
      events: ['subscription_lapsed'],
    })
    for (let i = 0; i < 50; i++) {
      await seedRefEvent(
        merchant.id,
        { kind: 'subscription.lapsed', subscriptionId: sub.id },
        `evt_race_${i}`,
      )
    }

    // Held back so failed sends can't auto-disable the endpoint partway through.
    const q: Queue = t.app.get(getQueueToken(QUEUE_NAMES.webhookDelivery))
    await q.pause()
    const outbox = t.app.get(WebhookOutboxService)
    const [a, b] = await Promise.all([outbox.tickNow(), outbox.tickNow()])
    const c = await outbox.tickNow()
    expect(a.dispatched + b.dispatched + c.dispatched).toBe(50)
    expect(a.deliveriesQueued + b.deliveriesQueued + c.deliveriesQueued).toBe(50)
    expect(await outbox.tickNow()).toEqual({ dispatched: 0, deliveriesQueued: 0 })
    const perEvent = await t.prisma.db.webhookDelivery.groupBy({
      by: ['eventId'],
      _count: { _all: true },
    })
    expect(perEvent).toHaveLength(50)
    expect(perEvent.every((row) => row._count._all === 1)).toBe(true)
    expect(await q.getWaitingCount()).toBe(50)
    await q.drain(true)
    await q.resume()
  })

  function runbookSql(name: string): string {
    return readFileSync(
      fileURLToPath(new URL(`../../../../docs/runbooks/${name}`, import.meta.url)),
      'utf8',
    )
  }

  async function seedRepairFixture() {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'lapsed' })
    const ref = { kind: 'subscription.lapsed', subscriptionId: sub.id }
    await seedRefEvent(merchant.id, ref, 'evt_stranded')
    await seedRefEvent(merchant.id, ref, 'evt_stranded_old')
    await seedRefEvent(merchant.id, ref, 'evt_no_subscribers')
    await seedRefEvent(merchant.id, ref, 'evt_quarantined')
    await t.app.get(WebhookOutboxService).tickNow()
    for (const id of ['evt_stranded', 'evt_stranded_old']) {
      await t.prisma.db.webhookEvent.update({ where: { id }, data: { payload: { ref } as never } })
    }
    await t.prisma.db.webhookEvent.update({
      where: { id: 'evt_stranded_old' },
      data: { createdAt: new Date(Date.now() - 30 * 86_400_000) },
    })
    await t.prisma.db.webhookEvent.update({
      where: { id: 'evt_quarantined' },
      data: { payload: { ref } as never, dispatchError: 'bad ref' },
    })
  }

  async function released(): Promise<string[]> {
    const rows = await t.prisma.db.webhookEvent.findMany({
      where: { dispatchedAt: null },
      orderBy: { id: 'asc' },
    })
    return rows.map((e) => e.id)
  }

  it('the count query counts only events stranded before hydration', async () => {
    await seedRepairFixture()
    const rows = await t.prisma.db.$queryRawUnsafe<{ type: string; stranded: bigint }[]>(
      runbookSql('webhook-outbox-stranded-count.sql'),
    )
    expect(rows.map((r) => [r.type, Number(r.stranded)])).toEqual([['subscription_lapsed', 2]])
  })

  it('the repair query releases only events stranded before hydration', async () => {
    await seedRepairFixture()
    expect(await t.prisma.db.$executeRawUnsafe(runbookSql('webhook-outbox-repair.sql'))).toBe(2)
    expect(await released()).toEqual(['evt_stranded', 'evt_stranded_old'])
  })

  it('the repair query with an age limit leaves older stranded events alone', async () => {
    await seedRepairFixture()
    const count = await t.prisma.db.$transaction(async (db) => {
      await db.$executeRaw`SET LOCAL strimz.repair_max_age = '7 days'`
      return db.$executeRawUnsafe(runbookSql('webhook-outbox-repair.sql'))
    })
    expect(count).toBe(1)
    expect(await released()).toEqual(['evt_stranded'])
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

  it('releases an event for the next tick when hydration fails for a transient reason', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, { status: 'lapsed' })
    await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'https://example.com/h',
      events: ['subscription_lapsed'],
    })
    await seedRefEvent(
      merchant.id,
      { kind: 'subscription.lapsed', subscriptionId: sub.id },
      'evt_outbox_transient',
    )
    const outbox = t.app.get(WebhookOutboxService)
    const spy = vi
      .spyOn(outbox as unknown as { hydrate: () => Promise<unknown> }, 'hydrate')
      .mockRejectedValueOnce(new Error('connection reset by peer'))

    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 0 })
    let event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_outbox_transient' },
    })
    expect(event.dispatchedAt).toBeNull()
    expect(event.dispatchError).toContain('connection reset')
    expect(await t.prisma.db.webhookDelivery.count()).toBe(0)

    expect(await outbox.tickNow()).toEqual({ dispatched: 1, deliveriesQueued: 1 })
    event = await t.prisma.db.webhookEvent.findUniqueOrThrow({
      where: { id: 'evt_outbox_transient' },
    })
    expect(event.dispatchedAt).not.toBeNull()
    expect(event.dispatchError).toBeNull()
    expect(await t.prisma.db.webhookDelivery.count()).toBe(1)
    spy.mockRestore()
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
