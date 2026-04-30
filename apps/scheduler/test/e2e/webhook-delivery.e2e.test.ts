import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedDelivery, seedMerchant, seedWebhookEndpoint, seedWebhookEvent } from '../helpers/fixtures.js'
import { WebhookDeliveryWorker } from '../../src/workers/webhook-delivery/webhook-delivery.worker.js'
import { WebhookSecretCache } from '../../src/infra/webhook-signing/secret-cache.service.js'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

/** Spin up a tiny HTTP listener for the worker to POST to. */
function startReceiver(handler: (req: { signature: string | null; body: string }) => { status: number; body?: string }) {
  return new Promise<{ url: string; close: () => Promise<void>; received: { signature: string | null; body: string }[] }>(
    (resolve) => {
      const received: { signature: string | null; body: string }[] = []
      const server: Server = createServer((req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          const sig = (req.headers['strimz-signature'] as string) ?? null
          received.push({ signature: sig, body })
          const out = handler({ signature: sig, body })
          res.writeHead(out.status, { 'content-type': 'text/plain' })
          res.end(out.body ?? '')
        })
      })
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as AddressInfo).port
        resolve({
          url: `http://127.0.0.1:${port}/hook`,
          received,
          close: () => new Promise((r) => server.close(() => r())),
        })
      })
    },
  )
}

describe('webhook-delivery worker e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
  })

  it('signs the body, POSTs, marks delivered on 200, bumps lastDeliveredAt', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const recv = await startReceiver(() => ({ status: 200 }))
    const { endpoint, secret } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: recv.url,
      events: ['payment_completed'],
      mode: 'test',
    })
    const cache = t.app.get(WebhookSecretCache)
    await cache.set(endpoint.id, secret)

    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed', { amount: '100' })
    const delivery = await seedDelivery(t.prisma.db, merchant.id, endpoint.id, event.id, 'payment_completed')

    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: recv.url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: async () => undefined },
    } as never)

    expect(result.status).toBe('delivered')
    expect(recv.received).toHaveLength(1)
    expect(recv.received[0]!.signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })
    expect(updated.status).toBe('delivered')
    expect(updated.responseCode).toBe(200)
    expect(updated.deliveredAt).not.toBeNull()

    const ep = await t.prisma.db.merchantWebhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } })
    expect(ep.lastDeliveredAt).not.toBeNull()

    await recv.close()
  })

  it('schedules a retry on 5xx and bumps attempt', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const recv = await startReceiver(() => ({ status: 500, body: 'boom' }))
    const { endpoint, secret } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: recv.url,
      events: ['payment_completed'],
      mode: 'test',
    })
    await t.app.get(WebhookSecretCache).set(endpoint.id, secret)
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')
    const delivery = await seedDelivery(t.prisma.db, merchant.id, endpoint.id, event.id, 'payment_completed')

    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: recv.url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: async () => undefined },
    } as never)

    expect(result.status).toBe('retrying')

    // The retry was enqueued onto the real BullMQ queue with a delay; check
    // that there is a delayed job.
    const queue: import('bullmq').Queue = t.app.get(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@nestjs/bullmq').getQueueToken('strimz.webhook.delivery'),
    )
    const delayed = await queue.getJobs(['delayed'])
    expect(delayed.length).toBeGreaterThan(0)

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })
    expect(updated.status).toBe('retrying')
    expect(updated.attempt).toBe(1)
    expect(updated.responseCode).toBe(500)
    expect(updated.lastError).toContain('boom')
    expect(updated.nextAttemptAt).not.toBeNull()

    await recv.close()
  })

  it('marks permanently_failed after WEBHOOK_MAX_ATTEMPTS and emails the merchant', async () => {
    const merchant = await seedMerchant(t.prisma.db, { email: 'merchant-on-call@strimz.test' })
    const recv = await startReceiver(() => ({ status: 503, body: 'unavailable' }))
    const { endpoint, secret } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: recv.url,
      events: ['payment_completed'],
      mode: 'test',
    })
    await t.app.get(WebhookSecretCache).set(endpoint.id, secret)
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')

    // Pre-populate attempt to maxAttempts - 1 so the next failure tips into permanent.
    const delivery = await t.prisma.db.webhookDelivery.create({
      data: {
        id: `whdl_${Math.random().toString(36).slice(2)}`,
        deliveryId: `whdl_${Math.random().toString(36).slice(2)}`,
        merchantId: merchant.id,
        endpointId: endpoint.id,
        eventId: event.id,
        eventName: 'payment_completed' as never,
        status: 'retrying',
        attempt: 2, // WEBHOOK_MAX_ATTEMPTS=3 in test env; next attempt → 3 = permanent
      },
    })

    t.email.reset()
    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: recv.url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: async () => undefined },
    } as never)

    expect(result.status).toBe('permanently_failed')

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })
    expect(updated.status).toBe('permanently_failed')
    expect(updated.responseCode).toBe(503)

    expect(t.email.sent).toHaveLength(1)
    expect(t.email.sent[0]!.to).toBe('merchant-on-call@strimz.test')
    expect(t.email.sent[0]!.subject).toContain('permanently failed')
    expect(t.email.sent[0]!.html).toContain(recv.url)
    expect(t.email.sent[0]!.html).toContain('503')

    await recv.close()
  })

  it('auto-disables the endpoint and emails after AUTO_DISABLE_THRESHOLD permanent failures in 24h', async () => {
    const merchant = await seedMerchant(t.prisma.db, { email: 'autodisable@strimz.test' })
    const recv = await startReceiver(() => ({ status: 503, body: 'down' }))
    const { endpoint, secret } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: recv.url,
      events: ['payment_completed'],
      mode: 'test',
    })
    await t.app.get(WebhookSecretCache).set(endpoint.id, secret)
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')

    // Pre-seed 4 prior permanently_failed deliveries within 24h. The 5th
    // (this one) tips us over the threshold.
    for (let i = 0; i < 4; i++) {
      await t.prisma.db.webhookDelivery.create({
        data: {
          id: `whdl_prior_${i}`,
          deliveryId: `whdl_prior_${i}`,
          merchantId: merchant.id,
          endpointId: endpoint.id,
          eventId: event.id,
          eventName: 'payment_completed' as never,
          status: 'permanently_failed',
          attempt: 3,
          responseCode: 503,
          lastError: 'down',
        },
      })
    }

    const trigger = await t.prisma.db.webhookDelivery.create({
      data: {
        id: `whdl_trigger`,
        deliveryId: `whdl_trigger`,
        merchantId: merchant.id,
        endpointId: endpoint.id,
        eventId: event.id,
        eventName: 'payment_completed' as never,
        status: 'retrying',
        attempt: 2,
      },
    })

    t.email.reset()
    const worker = t.app.get(WebhookDeliveryWorker)
    await worker.process({
      data: {
        deliveryId: trigger.id,
        endpointId: endpoint.id,
        url: recv.url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: async () => undefined },
    } as never)

    const ep = await t.prisma.db.merchantWebhookEndpoint.findUniqueOrThrow({ where: { id: endpoint.id } })
    expect(ep.status).toBe('disabled')

    expect(t.email.sent).toHaveLength(1)
    expect(t.email.sent[0]!.subject).toContain('auto-disabled')
    expect(t.email.sent[0]!.html).toContain('disabled automatically')

    await recv.close()
  })

  it('skips processing when delivery is already terminal', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const recv = await startReceiver(() => ({ status: 200 }))
    const { endpoint } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: recv.url,
      events: ['payment_completed'],
      mode: 'test',
    })
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')
    const delivery = await t.prisma.db.webhookDelivery.create({
      data: {
        id: `whdl_${Math.random().toString(36).slice(2)}`,
        deliveryId: `whdl_${Math.random().toString(36).slice(2)}`,
        merchantId: merchant.id,
        endpointId: endpoint.id,
        eventId: event.id,
        eventName: 'payment_completed' as never,
        status: 'delivered',
        attempt: 1,
      },
    })

    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: recv.url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: async () => undefined },
    } as never)
    expect(result.status).toBe('delivered')
    expect(recv.received).toHaveLength(0)
    await recv.close()
  })

  it('marks permanent when signing secret is missing from cache', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const { endpoint } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: 'http://127.0.0.1:1/never',
      events: ['payment_completed'],
      mode: 'test',
    })
    // No cache.set() — secret is missing.
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')
    const delivery = await seedDelivery(t.prisma.db, merchant.id, endpoint.id, event.id, 'payment_completed')

    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: 'http://127.0.0.1:1/never',
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: async () => undefined },
    } as never)
    expect(result.status).toBe('permanently_failed')

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })
    expect(updated.status).toBe('permanently_failed')
    expect(updated.lastError).toContain('signing secret')
  })
})
