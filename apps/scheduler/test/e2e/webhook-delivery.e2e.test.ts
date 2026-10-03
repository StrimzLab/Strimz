import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedDelivery,
  seedMerchant,
  seedWebhookEndpoint,
  seedWebhookEvent,
} from '../helpers/fixtures.js'
import { WebhookDeliveryWorker } from '../../src/workers/webhook-delivery/webhook-delivery.worker.js'
import { WebhookSecretCache } from '../../src/infra/webhook-signing/secret-cache.service.js'
import { createServer, type Server } from 'node:http'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import type { AddressInfo } from 'node:net'
import { must } from '../helpers/must.js'

/** Spin up a tiny HTTP listener for the worker to POST to. */
function startReceiver(
  handler: (req: { signature: string | null; body: string }) => {
    status: number
    body?: string
    headers?: Record<string, string>
  },
  listenHost = '127.0.0.1',
) {
  return new Promise<{
    url: string
    port: number
    close: () => Promise<void>
    received: { signature: string | null; body: string }[]
  }>((resolve) => {
    const received: { signature: string | null; body: string }[] = []
    const server: Server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const sig = (req.headers['strimz-signature'] as string) ?? null
        received.push({ signature: sig, body })
        const out = handler({ signature: sig, body })
        res.writeHead(out.status, { 'content-type': 'text/plain', ...out.headers })
        res.end(out.body ?? '')
      })
    })
    server.listen(0, listenHost, () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        url: `http://127.0.0.1:${port}/hook`,
        port,
        received,
        close: () => new Promise((r) => server.close(() => r())),
      })
    })
  })
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
    t.webhookTargets.reset()
  })

  async function startAllowedReceiver(handler: Parameters<typeof startReceiver>[0]) {
    const recv = await startReceiver(handler)
    t.webhookTargets.allowLoopbackPort(recv.port)
    return recv
  }

  it('signs the body, POSTs, marks delivered on 200, bumps lastDeliveredAt', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const recv = await startAllowedReceiver(() => ({ status: 200 }))
    const { endpoint, secret } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: recv.url,
      events: ['payment_completed'],
      mode: 'test',
    })
    const cache = t.app.get(WebhookSecretCache)
    await cache.set(endpoint.id, secret)

    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed', {
      amount: '100',
    })
    const delivery = await seedDelivery(
      t.prisma.db,
      merchant.id,
      endpoint.id,
      event.id,
      'payment_completed',
    )

    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: recv.url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: () => Promise.resolve(undefined) },
    } as never)

    expect(result.status).toBe('delivered')
    expect(recv.received).toHaveLength(1)
    expect(must(recv.received[0]).signature).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(updated.status).toBe('delivered')
    expect(updated.responseCode).toBe(200)
    expect(updated.deliveredAt).not.toBeNull()

    const ep = await t.prisma.db.merchantWebhookEndpoint.findUniqueOrThrow({
      where: { id: endpoint.id },
    })
    expect(ep.lastDeliveredAt).not.toBeNull()

    await recv.close()
  })

  it('schedules a retry on 5xx and bumps attempt', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const recv = await startAllowedReceiver(() => ({ status: 500, body: 'boom' }))
    const { endpoint, secret } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: recv.url,
      events: ['payment_completed'],
      mode: 'test',
    })
    await t.app.get(WebhookSecretCache).set(endpoint.id, secret)
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')
    const delivery = await seedDelivery(
      t.prisma.db,
      merchant.id,
      endpoint.id,
      event.id,
      'payment_completed',
    )

    const worker = t.app.get(WebhookDeliveryWorker)
    const startedAt = Date.now()
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: recv.url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: () => Promise.resolve(undefined) },
    } as never)
    const finishedAt = Date.now()

    expect(result.status).toBe('retrying')

    // The retry was enqueued onto the real BullMQ queue with a delay; check
    // that there is a delayed job.
    const queue: Queue = t.app.get(getQueueToken('strimz.webhook.delivery'))
    const delayed = await queue.getJobs(['delayed'])
    expect(delayed.length).toBeGreaterThan(0)

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(updated.status).toBe('retrying')
    expect(updated.attempt).toBe(2)
    expect(updated.responseCode).toBe(500)
    expect(updated.lastError).toContain('boom')
    const nextAttemptAt = must(updated.nextAttemptAt).getTime()
    expect(nextAttemptAt).toBeGreaterThanOrEqual(startedAt + 60_000)
    expect(nextAttemptAt).toBeLessThanOrEqual(finishedAt + 60_000)

    await recv.close()
  })

  it('does not follow a redirect and records the 3xx as a failed attempt', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const target = await startAllowedReceiver(() => ({ status: 200 }))
    const redirector = await startAllowedReceiver(() => ({
      status: 302,
      body: 'moved',
      headers: { location: target.url },
    }))
    const { endpoint, secret } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url: redirector.url,
      events: ['payment_completed'],
      mode: 'test',
    })
    await t.app.get(WebhookSecretCache).set(endpoint.id, secret)
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')
    const delivery = await seedDelivery(
      t.prisma.db,
      merchant.id,
      endpoint.id,
      event.id,
      'payment_completed',
    )

    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: redirector.url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: () => Promise.resolve(undefined) },
    } as never)

    expect(result).toEqual({ status: 'retrying', httpStatus: 302 })
    expect(redirector.received).toHaveLength(1)
    expect(target.received).toHaveLength(0)

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(updated.status).toBe('retrying')
    expect(updated.responseCode).toBe(302)
    expect(updated.deliveredAt).toBeNull()

    await redirector.close()
    await target.close()
  })

  it('refuses at send time a hostname that resolves to loopback', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const internal = await startReceiver(() => ({ status: 200, body: 'internal secret' }), '::')
    const url = `http://localhost:${internal.port}/hook`
    const { endpoint, secret } = await seedWebhookEndpoint(t.prisma.db, merchant.id, {
      url,
      events: ['payment_completed'],
      mode: 'test',
    })
    await t.app.get(WebhookSecretCache).set(endpoint.id, secret)
    const event = await seedWebhookEvent(t.prisma.db, merchant.id, 'payment_completed')
    const delivery = await seedDelivery(
      t.prisma.db,
      merchant.id,
      endpoint.id,
      event.id,
      'payment_completed',
    )

    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url,
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: () => Promise.resolve(undefined) },
    } as never)

    expect(result.status).toBe('retrying')
    expect(internal.received).toHaveLength(0)

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(updated.status).toBe('retrying')
    expect(updated.responseCode).toBeNull()
    expect(updated.responseBody).toBeNull()
    expect(updated.lastError).toMatch(/localhost resolves to blocked address/)

    await internal.close()
  })

  it('marks permanently_failed after WEBHOOK_MAX_ATTEMPTS and emails the merchant', async () => {
    const merchant = await seedMerchant(t.prisma.db, { email: 'merchant-on-call@strimz.test' })
    const recv = await startAllowedReceiver(() => ({ status: 503, body: 'unavailable' }))
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
        attempt: 3, // WEBHOOK_MAX_ATTEMPTS=3 in test env; next attempt → 3 = permanent
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
      queue: { add: () => Promise.resolve(undefined) },
    } as never)

    expect(result.status).toBe('permanently_failed')

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(updated.status).toBe('permanently_failed')
    expect(updated.responseCode).toBe(503)

    expect(t.email.sent).toHaveLength(1)
    expect(must(t.email.sent[0]).to).toBe('merchant-on-call@strimz.test')
    expect(must(t.email.sent[0]).subject).toContain('permanently failed')
    expect(must(t.email.sent[0]).html).toContain(recv.url)
    expect(must(t.email.sent[0]).html).toContain('503')

    await recv.close()
  })

  it('auto-disables the endpoint and emails after AUTO_DISABLE_THRESHOLD permanent failures in 24h', async () => {
    const merchant = await seedMerchant(t.prisma.db, { email: 'autodisable@strimz.test' })
    const recv = await startAllowedReceiver(() => ({ status: 503, body: 'down' }))
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
        attempt: 3,
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
      queue: { add: () => Promise.resolve(undefined) },
    } as never)

    const ep = await t.prisma.db.merchantWebhookEndpoint.findUniqueOrThrow({
      where: { id: endpoint.id },
    })
    expect(ep.status).toBe('disabled')

    expect(t.email.sent).toHaveLength(1)
    expect(must(t.email.sent[0]).subject).toContain('auto-disabled')
    expect(must(t.email.sent[0]).html).toContain('disabled automatically')

    await recv.close()
  })

  it('skips processing when delivery is already terminal', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const recv = await startAllowedReceiver(() => ({ status: 200 }))
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
      queue: { add: () => Promise.resolve(undefined) },
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
    const delivery = await seedDelivery(
      t.prisma.db,
      merchant.id,
      endpoint.id,
      event.id,
      'payment_completed',
    )

    const worker = t.app.get(WebhookDeliveryWorker)
    const result = await worker.process({
      data: {
        deliveryId: delivery.id,
        endpointId: endpoint.id,
        url: 'http://127.0.0.1:1/never',
        signingSecretHash: endpoint.signingSecretHash,
        eventId: event.id,
      },
      queue: { add: () => Promise.resolve(undefined) },
    } as never)
    expect(result.status).toBe('permanently_failed')

    const updated = await t.prisma.db.webhookDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    })
    expect(updated.status).toBe('permanently_failed')
    expect(updated.lastError).toContain('signing secret')
  })
})
