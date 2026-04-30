import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedSubscription } from '../helpers/fixtures.js'
import { WebhookEventService } from '../../src/infra/events/webhook-event.service.js'

describe('webhooks e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.queue.reset()
  })

  it('rejects http:// urls', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    const res = await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        url: 'http://example.com/hook',
        events: ['payment.completed'],
        mode: 'test',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects loopback / private urls (SSRF guard)', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    const res = await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        url: 'https://localhost/hook',
        events: ['payment.completed'],
        mode: 'test',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates an endpoint and returns the signing secret once', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)

    const res = await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        url: 'https://example.com/strimz',
        events: ['payment.completed', 'subscription.charged'],
        mode: 'test',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.signingSecret).toMatch(/^whsec_/)
    expect(body.endpoint.signingSecretPrefix).toBe(body.signingSecret.slice(0, 12))
    // Wire-format event names round-trip through Prisma enum storage.
    expect(body.endpoint.events).toEqual(['payment.completed', 'subscription.charged'])
  })

  it('rotate-secret returns a new secret', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    const create = await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        url: 'https://example.com/strimz',
        events: ['payment.completed'],
        mode: 'test',
      },
    })
    const epId = JSON.parse(create.body).endpoint.id
    const oldSecret = JSON.parse(create.body).signingSecret

    const rot = await t.inject({
      method: 'POST',
      url: `/v1/webhook-endpoints/${epId}/rotate-secret`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(rot.statusCode).toBe(201)
    expect(JSON.parse(rot.body).signingSecret).not.toBe(oldSecret)
  })

  it('WebhookEventService.fire materialises one delivery per active subscribed endpoint', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    // Active endpoint subscribed to subscription.cancelled.
    await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        url: 'https://example.com/cancelled',
        events: ['subscription.cancelled'],
        mode: 'test',
      },
    })
    // Active endpoint NOT subscribed to subscription.cancelled.
    await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        url: 'https://example.com/payments',
        events: ['payment.completed'],
        mode: 'test',
      },
    })

    const events = t.app.get(WebhookEventService)
    const result = await events.fire({
      merchantId: m.id,
      mode: 'test',
      name: 'subscription.cancelled',
      data: { id: 'sub_123' },
    })
    expect(result.deliveriesCreated).toBe(1)

    const delivJobs = t.queue.jobsFor('strimz.webhook.delivery')
    expect(delivJobs).toHaveLength(1)
  })

  it('replay re-enqueues a delivery onto the queue', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        url: 'https://example.com/replay',
        events: ['subscription.cancelled'],
        mode: 'test',
      },
    })
    // Trigger an event to produce a delivery row.
    const sub = await seedSubscription(t.prisma.db, m.id)
    const cancel = await t.inject({
      method: 'POST',
      url: `/v1/subscriptions/${sub.id}/cancel`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(cancel.statusCode).toBe(201)

    const delivery = await t.prisma.db.webhookDelivery.findFirstOrThrow()
    t.queue.reset()

    const res = await t.inject({
      method: 'POST',
      url: `/v1/webhook-deliveries/${delivery.id}/replay`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(res.statusCode).toBe(201)

    const jobs = t.queue.jobsFor('strimz.webhook.delivery')
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.data).toMatchObject({ replay: true })
  })
})
