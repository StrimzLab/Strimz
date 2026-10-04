import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type {
  InvoiceStatus,
  PaymentSessionStatus,
  PrismaClient,
  RefundStatus,
  SubscriptionInterval,
  SubscriptionStatus,
} from '@strimz/db'
import {
  adminOverviewSchema,
  adminMerchantStatsSchema,
  adminTopMerchantsSchema,
  adminVolumeSeriesSchema,
  statsForecastSchema,
  statsLtvSchema,
  statsMrrSchema,
  statsSummarySchema,
  statsVolumeSchema,
} from '@strimz/shared-types'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedCustomer, seedMerchant, seedPlan } from '../helpers/fixtures.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'

type Currency = 'USDC' | 'EURC'
type Mode = 'test' | 'live'

const DAY = 86_400_000

function daysAgo(days: number): Date {
  const d = new Date(Date.now() - days * DAY)
  d.setUTCHours(12, 0, 0, 0)
  return d
}

function randomHex(bytes: number): string {
  let out = '0x'
  for (let i = 0; i < bytes * 2; i++) out += Math.floor(Math.random() * 16).toString(16)
  return out
}

function seedTx(
  db: PrismaClient,
  merchantId: string,
  o: {
    currency: Currency
    amount: string
    fee?: string
    at?: Date
    status?: 'pending' | 'confirmed' | 'failed'
    mode?: Mode
    customerId?: string | null
    sessionId?: string | null
  },
) {
  const fee = o.fee ?? '0'
  return db.transaction.create({
    data: {
      merchantId,
      kind: 'one_shot',
      status: o.status ?? 'confirmed',
      amount: o.amount,
      feeAmount: fee,
      netAmount: (BigInt(o.amount) - BigInt(fee)).toString(),
      currency: o.currency,
      payerAddress: '0x' + 'b'.repeat(40),
      merchantAddress: '0x000000000000000000000000000000000000beef',
      onchainTxHash: randomHex(32),
      blockNumber: 1000n,
      blockTimestamp: o.at ?? new Date(),
      logIndex: 0,
      mode: o.mode ?? 'test',
      customerId: o.customerId ?? null,
      sessionId: o.sessionId ?? null,
    },
  })
}

function seedSession(
  db: PrismaClient,
  merchantId: string,
  o: {
    currency: Currency
    amount: string
    status: PaymentSessionStatus
    mode?: Mode
    customerId?: string
  },
) {
  return db.paymentSession.create({
    data: {
      merchantId,
      status: o.status,
      amount: o.amount,
      currency: o.currency,
      feeAmount: '0',
      netAmount: o.amount,
      checkoutUrl: 'https://checkout.strimz.test/pay/x',
      mode: o.mode ?? 'test',
      customerId: o.customerId ?? null,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  })
}

let invoiceSeq = 0

function seedInvoice(
  db: PrismaClient,
  merchantId: string,
  o: { currency: Currency; total: string; status: InvoiceStatus; paidAt?: Date; mode?: Mode },
) {
  invoiceSeq += 1
  return db.invoice.create({
    data: {
      merchantId,
      number: `INV-${invoiceSeq}`,
      lineItems: [{ description: 'Item', quantity: 1, unitAmount: o.total }],
      subtotal: o.total,
      total: o.total,
      currency: o.currency,
      status: o.status,
      mode: o.mode ?? 'test',
      dueAt: new Date(Date.now() + 7 * DAY),
      paidAt: o.paidAt ?? null,
    },
  })
}

function seedRefund(
  db: PrismaClient,
  merchantId: string,
  o: { currency: Currency; amount: string; status: RefundStatus; mode?: Mode },
) {
  return db.refund.create({
    data: {
      merchantId,
      transactionId: `tx_${Math.random().toString(36).slice(2)}`,
      amount: o.amount,
      currency: o.currency,
      reason: 'customer_request',
      status: o.status,
      payerAddress: '0x' + 'b'.repeat(40),
      initiatedById: merchantId,
      mode: o.mode ?? 'test',
    },
  })
}

async function seedSub(
  db: PrismaClient,
  merchantId: string,
  customerId: string,
  o: {
    currency: Currency
    amount: string
    status?: SubscriptionStatus
    interval?: SubscriptionInterval
    mode?: Mode
  },
) {
  const interval = o.interval ?? 'monthly'
  const plan = await seedPlan(db, merchantId, {
    amount: o.amount,
    currency: o.currency,
    interval,
  })
  const now = new Date()
  return db.subscription.create({
    data: {
      merchantId,
      planId: plan.id,
      customerId,
      payerAddress: '0x' + 'c'.repeat(40),
      currency: o.currency,
      amount: o.amount,
      interval,
      intervalCount: 1,
      gracePeriodHours: 48,
      status: o.status ?? 'active',
      mode: o.mode ?? 'test',
      currentPeriodStartAt: now,
      currentPeriodEndAt: new Date(now.getTime() + 30 * DAY),
      nextChargeAt: new Date(now.getTime() + 30 * DAY),
    },
  })
}

async function seedAdmin(db: PrismaClient): Promise<string> {
  const email = `ops-${Date.now()}-${Math.random().toString(36).slice(2)}@strimz.test`
  const did = makePrivyDid(email)
  await db.adminUser.create({ data: { email, privyUserId: did, role: 'read_only' } })
  return `test|${did}|${email}|`
}

describe('stats per currency e2e', () => {
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

  async function get(url: string, token: string) {
    const res = await t.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` },
    })
    return { status: res.statusCode, body: JSON.parse(res.body) }
  }

  describe('GET /v1/stats/summary', () => {
    it('returns server-side volume per currency for 7d, 30d and all time', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      const other = await seedMerchant(db)
      await seedTx(db, m.id, {
        currency: 'USDC',
        amount: '10000000',
        fee: '100000',
        at: daysAgo(1),
      })
      await seedTx(db, m.id, {
        currency: 'USDC',
        amount: '20000000',
        fee: '200000',
        at: daysAgo(10),
      })
      await seedTx(db, m.id, { currency: 'EURC', amount: '3000000', fee: '30000', at: daysAgo(2) })
      await seedTx(db, m.id, { currency: 'EURC', amount: '4000000', fee: '40000', at: daysAgo(40) })
      await seedTx(db, m.id, { currency: 'USDC', amount: '999000000', status: 'pending' })
      await seedTx(db, m.id, { currency: 'USDC', amount: '500000000', mode: 'live' })
      await seedTx(db, other.id, { currency: 'EURC', amount: '777000000', at: daysAgo(1) })

      const { status, body } = await get('/v1/stats/summary', m.privyAccessToken)

      expect(status).toBe(200)
      expect(body.mode).toBe('test')
      statsSummarySchema.parse(body)
      expect(body.volume.last7d).toEqual({
        count: 2,
        gross: { USDC: '10000000', EURC: '3000000' },
        fees: { USDC: '100000', EURC: '30000' },
        net: { USDC: '9900000', EURC: '2970000' },
      })
      expect(body.volume.last30d).toEqual({
        count: 3,
        gross: { USDC: '30000000', EURC: '3000000' },
        fees: { USDC: '300000', EURC: '30000' },
        net: { USDC: '29700000', EURC: '2970000' },
      })
      expect(body.volume.allTime.gross).toEqual({ USDC: '30000000', EURC: '7000000' })
      expect(body.volume.allTime.count).toBe(4)
    })

    it('returns payment session, invoice, refund, subscription and customer aggregates', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      const c1 = await seedCustomer(db, m.id, { walletAddress: '0x' + '1'.repeat(40) })
      const c2 = await seedCustomer(db, m.id, { walletAddress: '0x' + '2'.repeat(40) })

      await seedSession(db, m.id, { currency: 'USDC', amount: '10000000', status: 'confirmed' })
      await seedSession(db, m.id, { currency: 'EURC', amount: '3000000', status: 'confirmed' })
      await seedSession(db, m.id, { currency: 'USDC', amount: '50000000', status: 'created' })
      await seedSession(db, m.id, { currency: 'EURC', amount: '7000000', status: 'expired' })
      await seedSession(db, m.id, {
        currency: 'USDC',
        amount: '999000000',
        status: 'confirmed',
        mode: 'live',
      })

      await seedInvoice(db, m.id, { currency: 'USDC', total: '100000000', status: 'sent' })
      await seedInvoice(db, m.id, { currency: 'EURC', total: '40000000', status: 'overdue' })
      await seedInvoice(db, m.id, { currency: 'USDC', total: '5000000', status: 'overdue' })
      await seedInvoice(db, m.id, {
        currency: 'USDC',
        total: '12000000',
        status: 'paid',
        paidAt: daysAgo(3),
      })
      await seedInvoice(db, m.id, {
        currency: 'EURC',
        total: '8000000',
        status: 'paid',
        paidAt: daysAgo(45),
      })
      await seedInvoice(db, m.id, { currency: 'EURC', total: '1000000', status: 'draft' })

      await seedRefund(db, m.id, { currency: 'USDC', amount: '2000000', status: 'completed' })
      await seedRefund(db, m.id, { currency: 'EURC', amount: '1000000', status: 'completed' })
      await seedRefund(db, m.id, {
        currency: 'USDC',
        amount: '1000000',
        status: 'awaiting_signature',
      })
      await seedRefund(db, m.id, { currency: 'EURC', amount: '1000000', status: 'failed' })

      await seedSub(db, m.id, c1.id, { currency: 'USDC', amount: '20000000' })
      await seedSub(db, m.id, c2.id, { currency: 'EURC', amount: '9000000' })
      await seedSub(db, m.id, c2.id, { currency: 'EURC', amount: '9000000', status: 'trialing' })
      await seedSub(db, m.id, c1.id, { currency: 'USDC', amount: '1000000', status: 'cancelled' })

      const { status, body } = await get('/v1/stats/summary', m.privyAccessToken)

      expect(status).toBe(200)
      expect(body.paymentSessions.total).toBe(4)
      statsSummarySchema.parse(body)
      expect(body.paymentSessions.byStatus).toEqual({
        created: 1,
        awaiting_payment: 0,
        submitted: 0,
        confirmed: 2,
        failed: 0,
        expired: 1,
        cancelled: 0,
      })
      expect(body.paymentSessions.confirmed).toEqual({
        count: 2,
        amount: { USDC: '10000000', EURC: '3000000' },
      })

      expect(body.invoices.byStatus).toEqual({ draft: 1, sent: 1, paid: 2, overdue: 2, void: 0 })
      expect(body.invoices.outstanding).toEqual({
        count: 3,
        amount: { USDC: '105000000', EURC: '40000000' },
      })
      expect(body.invoices.overdue).toEqual({
        count: 2,
        amount: { USDC: '5000000', EURC: '40000000' },
      })
      expect(body.invoices.paidLast30d).toEqual({
        count: 1,
        amount: { USDC: '12000000', EURC: '0' },
      })

      expect(body.refunds.byStatus).toEqual({
        pending: 0,
        awaiting_signature: 1,
        submitted: 0,
        completed: 2,
        failed: 1,
        cancelled: 0,
      })
      expect(body.refunds.completed).toEqual({
        count: 2,
        amount: { USDC: '2000000', EURC: '1000000' },
      })

      expect(body.subscriptions.total).toBe(4)
      expect(body.subscriptions.byStatus).toEqual({
        trialing: 1,
        active: 2,
        at_risk: 0,
        paused: 0,
        cancelled: 1,
        lapsed: 0,
      })

      expect(body.customers.total).toBe(2)
    })

    it('is readable by an API key with analytics_read and refused without it', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      const reader = await seedApiKey(db, m.id, { scopes: ['analytics_read'] })
      const outsider = await seedApiKey(db, m.id, { scopes: ['invoices_read'] })

      const ok = await get('/v1/stats/summary', reader.secretKey)
      expect(ok.status).toBe(200)
      expect(ok.body.volume.allTime.gross).toEqual({ USDC: '0', EURC: '0' })

      const denied = await get('/v1/stats/summary', outsider.secretKey)
      expect(denied.status).toBe(403)
      expect(denied.body.error.code).toBe('permission_denied')
    })
  })

  describe('GET /v1/stats/volume', () => {
    it('returns one row per day and currency', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      const day = daysAgo(2)
      await seedTx(db, m.id, { currency: 'USDC', amount: '10000000', fee: '100000', at: day })
      await seedTx(db, m.id, { currency: 'USDC', amount: '5000000', fee: '50000', at: day })
      await seedTx(db, m.id, { currency: 'EURC', amount: '3000000', fee: '30000', at: day })

      const from = daysAgo(7).toISOString()
      const to = new Date().toISOString()
      const { status, body } = await get(
        `/v1/stats/volume?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        m.privyAccessToken,
      )

      expect(status).toBe(200)
      statsVolumeSchema.parse(body)
      const dayKey = day.toISOString().slice(0, 10)
      expect(body.data).toEqual([
        {
          day: dayKey,
          currency: 'USDC',
          count: 2,
          gross: '15000000',
          fees: '150000',
          net: '14850000',
        },
        {
          day: dayKey,
          currency: 'EURC',
          count: 1,
          gross: '3000000',
          fees: '30000',
          net: '2970000',
        },
      ])
    })
  })

  describe('GET /v1/stats/mrr', () => {
    it('returns MRR per currency and never adds EURC to USDC', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      const c = await seedCustomer(db, m.id)
      await seedSub(db, m.id, c.id, { currency: 'USDC', amount: '20000000' })
      await seedSub(db, m.id, c.id, { currency: 'USDC', amount: '120000000', interval: 'yearly' })
      await seedSub(db, m.id, c.id, { currency: 'EURC', amount: '9000000' })
      await seedSub(db, m.id, c.id, { currency: 'EURC', amount: '9000000', status: 'trialing' })
      await seedSub(db, m.id, c.id, {
        currency: 'USDC',
        amount: '1000000000',
        status: 'cancelled',
      })
      await seedSub(db, m.id, c.id, { currency: 'USDC', amount: '1000000000', mode: 'live' })

      const { status, body } = await get('/v1/stats/mrr', m.privyAccessToken)

      expect(status).toBe(200)
      statsMrrSchema.parse(body)
      expect(body).toEqual({
        mrr: { USDC: '30000000', EURC: '9000000' },
        activeSubscribers: 3,
      })
    })
  })

  describe('GET /v1/stats/ltv', () => {
    it('ranks customers within one currency', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      const c1 = await seedCustomer(db, m.id, { walletAddress: '0x' + '1'.repeat(40) })
      const c2 = await seedCustomer(db, m.id, { walletAddress: '0x' + '2'.repeat(40) })
      await seedTx(db, m.id, { currency: 'USDC', amount: '10000000', customerId: c1.id })
      await seedTx(db, m.id, { currency: 'USDC', amount: '20000000', customerId: c1.id })
      await seedTx(db, m.id, { currency: 'EURC', amount: '3000000', customerId: c1.id })
      await seedTx(db, m.id, { currency: 'USDC', amount: '5000000', customerId: c2.id })
      await seedTx(db, m.id, { currency: 'EURC', amount: '50000000', customerId: c2.id })

      const usdc = await get('/v1/stats/ltv?currency=USDC', m.privyAccessToken)
      expect(usdc.status).toBe(200)
      statsLtvSchema.parse(usdc.body)
      expect(usdc.body.currency).toBe('USDC')
      expect(usdc.body.data).toEqual([
        { customerId: c1.id, totalSpend: '30000000', transactionCount: 2 },
        { customerId: c2.id, totalSpend: '5000000', transactionCount: 1 },
      ])

      const eurc = await get('/v1/stats/ltv?currency=EURC', m.privyAccessToken)
      expect(eurc.status).toBe(200)
      statsLtvSchema.parse(eurc.body)
      expect(eurc.body.data).toEqual([
        { customerId: c2.id, totalSpend: '50000000', transactionCount: 1 },
        { customerId: c1.id, totalSpend: '3000000', transactionCount: 1 },
      ])
    })

    it('rejects a request without a currency', async () => {
      const m = await seedMerchant(t.prisma.db)
      const { status, body } = await get('/v1/stats/ltv', m.privyAccessToken)
      expect(status).toBe(400)
      expect(body.error.code).toBe('invalid_request')
    })

    it('attributes a payment to the customer of its session when the transaction has none', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      const c = await seedCustomer(db, m.id)
      const s = await seedSession(db, m.id, {
        currency: 'USDC',
        amount: '7000000',
        status: 'confirmed',
        customerId: c.id,
      })
      await seedTx(db, m.id, { currency: 'USDC', amount: '7000000', sessionId: s.id })

      const { status, body } = await get('/v1/stats/ltv?currency=USDC', m.privyAccessToken)
      expect(status).toBe(200)
      expect(body.data).toEqual([{ customerId: c.id, totalSpend: '7000000', transactionCount: 1 }])
    })
  })

  describe('GET /v1/stats/ltv paging', () => {
    it('pages with a cursor and reports hasMore', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      const spends = ['30000000', '20000000', '20000000', '10000000']
      const ids: string[] = []
      for (let i = 0; i < spends.length; i++) {
        const c = await seedCustomer(db, m.id, { walletAddress: '0x' + String(i + 1).repeat(40) })
        ids.push(c.id)
        await seedTx(db, m.id, { currency: 'USDC', amount: spends[i] as string, customerId: c.id })
      }
      const tied = [ids[1], ids[2]].sort() as string[]
      const expected = [ids[0], ...tied, ids[3]]

      const seen: string[] = []
      let cursor: string | null = null
      let pages = 0
      do {
        const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
        const page = await get(`/v1/stats/ltv?currency=USDC&limit=3${query}`, m.privyAccessToken)
        expect(page.status).toBe(200)
        statsLtvSchema.parse(page.body)
        seen.push(...page.body.data.map((r: { customerId: string }) => r.customerId))
        expect(page.body.hasMore).toBe(pages === 0)
        cursor = page.body.nextCursor
        pages += 1
      } while (cursor)

      expect(pages).toBe(2)
      expect(seen).toEqual(expected)

      const bad = await get('/v1/stats/ltv?currency=USDC&cursor=not-a-cursor', m.privyAccessToken)
      expect(bad.status).toBe(400)
      expect(bad.body.error.code).toBe('invalid_request')
    })
  })

  describe('GET /v1/stats/forecast', () => {
    it('forecasts each currency from its own history', async () => {
      const db = t.prisma.db
      const m = await seedMerchant(db)
      for (let d = 1; d <= 10; d++) {
        await seedTx(db, m.id, { currency: 'USDC', amount: '1000000', at: daysAgo(d) })
      }
      await seedTx(db, m.id, { currency: 'EURC', amount: '5000000', at: daysAgo(2) })
      await seedTx(db, m.id, { currency: 'EURC', amount: '5000000', at: daysAgo(3) })

      const { status, body } = await get('/v1/stats/forecast', m.privyAccessToken)

      expect(status).toBe(200)
      statsForecastSchema.parse(body)
      expect(body.byCurrency.USDC).toEqual({
        confidence: 'low',
        last90DayRevenue: '10000000',
        next30: '30000000',
        next60: '60000000',
        next90: '90000000',
      })
      expect(body.byCurrency.EURC).toEqual({
        confidence: 'low',
        last90DayRevenue: '10000000',
        next30: '0',
        next60: '0',
        next90: '0',
      })
    })
  })

  describe('admin figures', () => {
    it('GET /v1/admin/overview reports volume, fees and MRR per currency for one mode', async () => {
      const db = t.prisma.db
      const token = await seedAdmin(db)
      const m = await seedMerchant(db)
      const c = await seedCustomer(db, m.id)
      await seedTx(db, m.id, {
        currency: 'USDC',
        amount: '10000000',
        fee: '100000',
        at: daysAgo(1),
      })
      await seedTx(db, m.id, { currency: 'EURC', amount: '3000000', fee: '30000', at: daysAgo(40) })
      await seedTx(db, m.id, {
        currency: 'USDC',
        amount: '500000000',
        fee: '5000000',
        mode: 'live',
      })
      await seedSub(db, m.id, c.id, { currency: 'USDC', amount: '20000000' })
      await seedSub(db, m.id, c.id, { currency: 'EURC', amount: '9000000' })

      const test = await get('/v1/admin/overview?mode=test', token)
      expect(test.status).toBe(200)
      adminOverviewSchema.parse(test.body)
      expect(test.body.mode).toBe('test')
      expect(test.body.volume.lifetime).toEqual({ USDC: '10000000', EURC: '3000000' })
      expect(test.body.volume.lifetimeFees).toEqual({ USDC: '100000', EURC: '30000' })
      expect(test.body.volume.last30d).toEqual({ USDC: '10000000', EURC: '0' })
      expect(test.body.subscriptions.mrr).toEqual({ USDC: '20000000', EURC: '9000000' })

      const live = await get('/v1/admin/overview', token)
      expect(live.status).toBe(200)
      expect(live.body.mode).toBe('live')
      expect(live.body.volume.lifetime).toEqual({ USDC: '500000000', EURC: '0' })
      expect(live.body.subscriptions.mrr).toEqual({ USDC: '0', EURC: '0' })
    })

    it('GET /v1/admin/merchants/:id reports merchant volume per currency', async () => {
      const db = t.prisma.db
      const token = await seedAdmin(db)
      const m = await seedMerchant(db)
      await seedTx(db, m.id, { currency: 'USDC', amount: '10000000', at: daysAgo(1) })
      await seedTx(db, m.id, { currency: 'EURC', amount: '3000000', at: daysAgo(40) })

      const { status, body } = await get(`/v1/admin/merchants/${m.id}?mode=test`, token)
      expect(status).toBe(200)
      adminMerchantStatsSchema.parse(body.stats)
      expect(body.stats.lifetimeVolume).toEqual({ USDC: '10000000', EURC: '3000000' })
      expect(body.stats.last30dVolume).toEqual({ USDC: '10000000', EURC: '0' })
    })

    it('GET /v1/admin/analytics/volume returns one row per day and currency', async () => {
      const db = t.prisma.db
      const token = await seedAdmin(db)
      const m = await seedMerchant(db)
      const day = daysAgo(2)
      await seedTx(db, m.id, { currency: 'USDC', amount: '10000000', fee: '100000', at: day })
      await seedTx(db, m.id, { currency: 'EURC', amount: '3000000', fee: '30000', at: day })

      const { status, body } = await get('/v1/admin/analytics/volume?mode=test', token)
      expect(status).toBe(200)
      adminVolumeSeriesSchema.parse(body)
      const dayKey = day.toISOString().slice(0, 10)
      expect(body.data).toEqual([
        { day: dayKey, currency: 'USDC', volume: '10000000', fees: '100000', count: 1 },
        { day: dayKey, currency: 'EURC', volume: '3000000', fees: '30000', count: 1 },
      ])
    })

    it('GET /v1/admin/analytics/top-merchants ranks within one currency', async () => {
      const db = t.prisma.db
      const token = await seedAdmin(db)
      const a = await seedMerchant(db, { businessName: 'A' })
      const b = await seedMerchant(db, { businessName: 'B' })
      await seedTx(db, a.id, { currency: 'USDC', amount: '100000000' })
      await seedTx(db, a.id, { currency: 'EURC', amount: '1000000' })
      await seedTx(db, b.id, { currency: 'EURC', amount: '50000000' })

      const eurc = await get('/v1/admin/analytics/top-merchants?currency=EURC&mode=test', token)
      expect(eurc.status).toBe(200)
      adminTopMerchantsSchema.parse(eurc.body)
      expect(
        eurc.body.data.map((r: { merchantId: string; volume: string }) => [r.merchantId, r.volume]),
      ).toEqual([
        [b.id, '50000000'],
        [a.id, '1000000'],
      ])

      const missing = await get('/v1/admin/analytics/top-merchants?mode=test', token)
      expect(missing.status).toBe(400)
      expect(missing.body.error.code).toBe('invalid_request')
    })
  })
})
