import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { PrismaClient } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedApiKey,
  seedMerchant,
  seedPaymentSession,
  seedPlan,
  seedSubscription,
  seedTransaction,
} from '../helpers/fixtures.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'

const OCT_1 = '2026-10-01T00:00:00Z'
const NOV_1 = '2026-11-01T00:00:00Z'
const ADMIN_EMAIL = 'ops@strimz.test'
const adminToken = `test|${makePrivyDid(ADMIN_EMAIL)}|${ADMIN_EMAIL}|`

describe('list filters take several values', () => {
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

  const get = (token: string, path: string) =>
    t.inject({ method: 'GET', url: path, headers: { authorization: `Bearer ${token}` } })

  const rows = (body: string) => JSON.parse(body).data as Array<{ id: string }>
  const ids = (body: string) => rows(body).map((r) => r.id)
  const sorted = (xs: string[]) => [...xs].sort()

  async function merchantWithKey() {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, {
      scopes: [
        'sessions_read',
        'transactions_read',
        'subscriptions_read',
        'invoices_read',
        'refunds_read',
        'webhooks_read',
        'agents_read',
      ],
    })
    return { m, key: k.secretKey }
  }

  let invoiceSeq = 0
  function seedInvoice(db: PrismaClient, merchantId: string, status: 'draft' | 'sent' | 'paid') {
    invoiceSeq += 1
    return db.invoice.create({
      data: {
        merchantId,
        number: `INV-${invoiceSeq}`,
        lineItems: [{ description: 'Item', quantity: 1, unitAmount: '1000000' }],
        subtotal: '1000000',
        total: '1000000',
        currency: 'USDC',
        status,
        mode: 'test',
        dueAt: new Date(Date.now() + 7 * 86_400_000),
      },
    })
  }

  function seedRefund(
    db: PrismaClient,
    merchantId: string,
    status: 'pending' | 'completed' | 'failed',
  ) {
    return db.refund.create({
      data: {
        merchantId,
        transactionId: `tx_${Math.random().toString(36).slice(2)}`,
        amount: '1000000',
        currency: 'USDC',
        reason: 'customer_request',
        status,
        payerAddress: '0x' + 'b'.repeat(40),
        initiatedById: merchantId,
        mode: 'test',
      },
    })
  }

  async function seedDeliveries(merchantId: string) {
    const endpoint = await t.prisma.db.merchantWebhookEndpoint.create({
      data: {
        merchantId,
        mode: 'test',
        url: 'https://example.com/hook',
        events: ['payment_completed', 'refund_completed'],
        signingSecretHash: 'hash',
        signingSecretPrefix: 'whsec_test',
      },
    })
    const delivery = async (
      eventName: 'payment_completed' | 'refund_completed',
      status: 'delivered' | 'retrying' | 'permanently_failed',
    ) => {
      const event = await t.prisma.db.webhookEvent.create({
        data: { merchantId, type: eventName, apiVersion: '2026-04-27', mode: 'test', payload: {} },
      })
      const deliveryId = `whdl_${Math.random().toString(36).slice(2)}`
      return t.prisma.db.webhookDelivery.create({
        data: {
          id: deliveryId,
          deliveryId,
          merchantId,
          endpointId: endpoint.id,
          eventId: event.id,
          eventName,
          status,
        },
      })
    }
    return {
      delivered: await delivery('payment_completed', 'delivered'),
      retrying: await delivery('refund_completed', 'retrying'),
      failed: await delivery('payment_completed', 'permanently_failed'),
    }
  }

  describe('GET /v1/payment-sessions', () => {
    it('returns sessions in any of the listed statuses', async () => {
      const { m, key } = await merchantWithKey()
      const confirmed = await seedPaymentSession(t.prisma.db, m.id, { status: 'confirmed' })
      const expired = await seedPaymentSession(t.prisma.db, m.id, { status: 'expired' })
      await seedPaymentSession(t.prisma.db, m.id, { status: 'created' })

      const res = await get(key, '/v1/payment-sessions?status=confirmed,expired')

      expect(res.statusCode).toBe(200)
      expect(sorted(ids(res.body))).toEqual(sorted([confirmed.id, expired.id]))
    })

    it('still takes a single status', async () => {
      const { m, key } = await merchantWithKey()
      const confirmed = await seedPaymentSession(t.prisma.db, m.id, { status: 'confirmed' })
      await seedPaymentSession(t.prisma.db, m.id, { status: 'created' })

      const res = await get(key, '/v1/payment-sessions?status=confirmed')

      expect(ids(res.body)).toEqual([confirmed.id])
    })

    it('refuses a status sessions do not have', async () => {
      const { key } = await merchantWithKey()

      const res = await get(key, '/v1/payment-sessions?status=confirmed,paid')

      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('invalid_request')
    })

    it('refuses an empty list', async () => {
      const { key } = await merchantWithKey()

      expect((await get(key, '/v1/payment-sessions?status=,')).statusCode).toBe(400)
    })
  })

  describe('GET /v1/transactions', () => {
    it('filters on several kinds and statuses together', async () => {
      const { m, key } = await merchantWithKey()
      const payment = await seedTransaction(t.prisma.db, m.id, { status: 'confirmed' })
      const pending = await seedTransaction(t.prisma.db, m.id, { status: 'pending' })
      await seedTransaction(t.prisma.db, m.id, { status: 'failed' })
      const refund = await seedTransaction(t.prisma.db, m.id, { status: 'confirmed' })
      await t.prisma.db.transaction.update({ where: { id: refund.id }, data: { kind: 'refund' } })
      const charge = await seedTransaction(t.prisma.db, m.id, { status: 'confirmed' })
      await t.prisma.db.transaction.update({
        where: { id: charge.id },
        data: { kind: 'subscription_charge' },
      })

      const res = await get(key, '/v1/transactions?kind=one_shot,refund&status=confirmed,pending')

      expect(sorted(ids(res.body))).toEqual(sorted([payment.id, pending.id, refund.id]))
    })

    it('refuses an unknown kind', async () => {
      const { key } = await merchantWithKey()

      expect((await get(key, '/v1/transactions?kind=one_shot,gift')).statusCode).toBe(400)
    })
  })

  describe('GET /v1/subscriptions', () => {
    it('returns subscriptions in any of the listed statuses', async () => {
      const { m, key } = await merchantWithKey()
      const active = await seedSubscription(t.prisma.db, m.id, { status: 'active' })
      const atRisk = await seedSubscription(t.prisma.db, m.id, { status: 'at_risk' })
      await seedSubscription(t.prisma.db, m.id, { status: 'cancelled' })

      const res = await get(key, '/v1/subscriptions?status=active,at_risk')

      expect(sorted(ids(res.body))).toEqual(sorted([active.id, atRisk.id]))
    })
  })

  describe('GET /v1/subscription-plans', () => {
    it('returns plans in any of the listed statuses', async () => {
      const { m, key } = await merchantWithKey()
      const active = await seedPlan(t.prisma.db, m.id, { status: 'active' })
      const archived = await seedPlan(t.prisma.db, m.id, { status: 'archived' })

      const res = await get(key, '/v1/subscription-plans?status=active,archived')

      expect(sorted(ids(res.body))).toEqual(sorted([active.id, archived.id]))
    })
  })

  describe('GET /v1/invoices', () => {
    it('returns invoices in any of the listed statuses', async () => {
      const { m, key } = await merchantWithKey()
      const sent = await seedInvoice(t.prisma.db, m.id, 'sent')
      const paid = await seedInvoice(t.prisma.db, m.id, 'paid')
      await seedInvoice(t.prisma.db, m.id, 'draft')

      const res = await get(key, '/v1/invoices?status=sent,paid')

      expect(sorted(ids(res.body))).toEqual(sorted([sent.id, paid.id]))
    })
  })

  describe('GET /v1/refunds', () => {
    it('returns refunds in any of the listed statuses', async () => {
      const { m, key } = await merchantWithKey()
      const pending = await seedRefund(t.prisma.db, m.id, 'pending')
      const failed = await seedRefund(t.prisma.db, m.id, 'failed')
      await seedRefund(t.prisma.db, m.id, 'completed')

      const res = await get(key, '/v1/refunds?status=pending,failed')

      expect(sorted(ids(res.body))).toEqual(sorted([pending.id, failed.id]))
    })
  })

  describe('GET /v1/webhook-deliveries', () => {
    it('filters on several statuses', async () => {
      const { m, key } = await merchantWithKey()
      const d = await seedDeliveries(m.id)

      const res = await get(key, '/v1/webhook-deliveries?status=retrying,permanently_failed')

      expect(sorted(ids(res.body))).toEqual(sorted([d.retrying.id, d.failed.id]))
    })

    it('filters on several event names, dotted or not', async () => {
      const { m, key } = await merchantWithKey()
      const d = await seedDeliveries(m.id)

      const res = await get(key, '/v1/webhook-deliveries?eventName=refund.completed')
      expect(ids(res.body)).toEqual([d.retrying.id])

      const both = await get(
        key,
        '/v1/webhook-deliveries?eventName=payment_completed,refund.completed',
      )
      expect(rows(both.body)).toHaveLength(3)
    })

    it('refuses an unknown delivery status', async () => {
      const { key } = await merchantWithKey()

      expect((await get(key, '/v1/webhook-deliveries?status=lost')).statusCode).toBe(400)
    })
  })

  describe('GET /v1/agents/activity', () => {
    it('filters on several outcomes', async () => {
      const { m, key } = await merchantWithKey()
      const log = (outcome: 'success' | 'failure' | 'skipped') =>
        t.prisma.db.agentActivityLog.create({
          data: {
            merchantId: m.id,
            capability: 'recovery',
            actionType: 'recovery_notification_sent',
            outcome,
          },
        })
      const success = await log('success')
      const failure = await log('failure')
      await log('skipped')

      const res = await get(key, '/v1/agents/activity?outcome=success,failure')

      expect(sorted(ids(res.body))).toEqual(sorted([success.id, failure.id]))
    })
  })

  describe('GET /v1/admin/merchants', () => {
    it('filters on several statuses and tiers', async () => {
      await t.prisma.db.adminUser.create({
        data: { email: ADMIN_EMAIL, role: 'admin', privyUserId: makePrivyDid(ADMIN_EMAIL) },
      })
      const free = await seedMerchant(t.prisma.db, { tier: 'free' })
      const growth = await seedMerchant(t.prisma.db, { tier: 'growth' })
      await seedMerchant(t.prisma.db, { tier: 'enterprise' })
      const suspended = await seedMerchant(t.prisma.db, { tier: 'free' })
      await t.prisma.db.merchant.update({
        where: { id: suspended.id },
        data: { status: 'suspended' },
      })

      const res = await get(adminToken, '/v1/admin/merchants?status=active&tier=free,growth')

      expect(res.statusCode).toBe(200)
      expect(sorted(ids(res.body))).toEqual(sorted([free.id, growth.id]))
    })
  })

  describe('from / to on more list routes', () => {
    const backdate = (
      model: 'paymentSession' | 'subscription' | 'invoice' | 'refund' | 'webhookDelivery',
      id: string,
      iso: string,
    ) =>
      (
        t.prisma.db[model] as unknown as {
          update: (a: { where: { id: string }; data: { createdAt: Date } }) => Promise<unknown>
        }
      ).update({ where: { id }, data: { createdAt: new Date(iso) } })

    it('filters payment sessions on when they were created', async () => {
      const { m, key } = await merchantWithKey()
      const inside = await seedPaymentSession(t.prisma.db, m.id)
      const before = await seedPaymentSession(t.prisma.db, m.id)
      await backdate('paymentSession', inside.id, '2026-10-15T00:00:00Z')
      await backdate('paymentSession', before.id, '2026-09-15T00:00:00Z')

      const res = await get(key, `/v1/payment-sessions?from=${OCT_1}&to=${NOV_1}`)

      expect(ids(res.body)).toEqual([inside.id])
    })

    it('filters subscriptions on when they were created', async () => {
      const { m, key } = await merchantWithKey()
      const inside = await seedSubscription(t.prisma.db, m.id)
      const after = await seedSubscription(t.prisma.db, m.id)
      await backdate('subscription', inside.id, '2026-10-15T00:00:00Z')
      await backdate('subscription', after.id, '2026-11-01T00:00:00Z')

      const res = await get(key, `/v1/subscriptions?from=${OCT_1}&to=${NOV_1}`)

      expect(ids(res.body)).toEqual([inside.id])
    })

    it('filters invoices on when they were created', async () => {
      const { m, key } = await merchantWithKey()
      const inside = await seedInvoice(t.prisma.db, m.id, 'sent')
      const before = await seedInvoice(t.prisma.db, m.id, 'sent')
      await backdate('invoice', inside.id, '2026-10-15T00:00:00Z')
      await backdate('invoice', before.id, '2026-09-30T23:59:59Z')

      const res = await get(key, `/v1/invoices?from=${OCT_1}&to=${NOV_1}`)

      expect(ids(res.body)).toEqual([inside.id])
    })

    it('filters refunds on when they were created', async () => {
      const { m, key } = await merchantWithKey()
      const inside = await seedRefund(t.prisma.db, m.id, 'completed')
      const before = await seedRefund(t.prisma.db, m.id, 'completed')
      await backdate('refund', inside.id, '2026-10-15T00:00:00Z')
      await backdate('refund', before.id, '2026-09-15T00:00:00Z')

      const res = await get(key, `/v1/refunds?from=${OCT_1}&to=${NOV_1}`)

      expect(ids(res.body)).toEqual([inside.id])
    })

    it('filters webhook deliveries on when they were created', async () => {
      const { m, key } = await merchantWithKey()
      const d = await seedDeliveries(m.id)
      await backdate('webhookDelivery', d.delivered.id, '2026-10-15T00:00:00Z')
      await backdate('webhookDelivery', d.retrying.id, '2026-09-15T00:00:00Z')
      await backdate('webhookDelivery', d.failed.id, '2026-11-02T00:00:00Z')

      const res = await get(key, `/v1/webhook-deliveries?from=${OCT_1}&to=${NOV_1}`)

      expect(ids(res.body)).toEqual([d.delivered.id])
    })

    it('refuses a range that ends before it starts', async () => {
      const { key } = await merchantWithKey()

      expect((await get(key, `/v1/invoices?from=${NOV_1}&to=${OCT_1}`)).statusCode).toBe(400)
    })
  })
})
