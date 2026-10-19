import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedApiKey,
  seedCustomer,
  seedMerchant,
  seedPaymentSession,
  seedSubscription,
  seedTransaction,
} from '../helpers/fixtures.js'

const SCOPES = [
  'customers_read',
  'sessions_read',
  'subscriptions_read',
  'transactions_read',
  'refunds_read',
  'invoices_read',
]

describe('customer filters on list endpoints', () => {
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

  function get(secretKey: string, url: string) {
    return t.inject({ method: 'GET', url, headers: { authorization: `Bearer ${secretKey}` } })
  }

  const ids = (body: string) => (JSON.parse(body).data as Array<{ id: string }>).map((r) => r.id)

  function seedRefund(merchantId: string, transactionId: string) {
    return t.prisma.db.refund.create({
      data: {
        merchantId,
        transactionId,
        amount: '1000000',
        currency: 'USDC',
        reason: 'customer_request',
        payerAddress: '0x' + 'b'.repeat(40),
        initiatedById: 'user_test',
        mode: 'test',
      },
    })
  }

  let seq = 0
  function seedInvoice(merchantId: string, sessionId: string | null) {
    seq += 1
    return t.prisma.db.invoice.create({
      data: {
        merchantId,
        number: `INV-${seq}`,
        lineItems: [{ description: 'Work', quantity: 1, unitAmount: '1000000' }],
        subtotal: '1000000',
        total: '1000000',
        currency: 'USDC',
        status: 'sent',
        sessionId,
        mode: 'test',
        dueAt: new Date(Date.now() + 86_400_000),
      },
    })
  }

  async function world() {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: SCOPES })
    const ada = await seedCustomer(t.prisma.db, m.id)
    const bob = await seedCustomer(t.prisma.db, m.id)
    return { m, k, ada, bob }
  }

  it('lists only the payment sessions of one customer', async () => {
    const { m, k, ada, bob } = await world()
    const mine = await seedPaymentSession(t.prisma.db, m.id, { customerId: ada.id })
    await seedPaymentSession(t.prisma.db, m.id, { customerId: bob.id })
    await seedPaymentSession(t.prisma.db, m.id)

    const res = await get(k.secretKey, `/v1/payment-sessions?customerId=${ada.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([mine.id])
  })

  it('lists only the subscriptions of one customer', async () => {
    const { m, k, ada, bob } = await world()
    const mine = await seedSubscription(t.prisma.db, m.id, { customerId: ada.id })
    await seedSubscription(t.prisma.db, m.id, { customerId: bob.id })

    const res = await get(k.secretKey, `/v1/subscriptions?customerId=${ada.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([mine.id])
  })

  it('lists only the transactions of one customer', async () => {
    const { m, k, ada, bob } = await world()
    const mine = await seedTransaction(t.prisma.db, m.id, { customerId: ada.id })
    await seedTransaction(t.prisma.db, m.id, { customerId: bob.id })
    await seedTransaction(t.prisma.db, m.id)

    const res = await get(k.secretKey, `/v1/transactions?customerId=${ada.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([mine.id])
  })

  it('lists refunds of the payments one customer made', async () => {
    const { m, k, ada, bob } = await world()
    const paid = await seedTransaction(t.prisma.db, m.id, { customerId: ada.id })
    const other = await seedTransaction(t.prisma.db, m.id, { customerId: bob.id })
    const mine = await seedRefund(m.id, paid.id)
    await seedRefund(m.id, other.id)

    const res = await get(k.secretKey, `/v1/refunds?customerId=${ada.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([mine.id])
  })

  it('lists invoices whose payment session belongs to one customer', async () => {
    const { m, k, ada, bob } = await world()
    const adaSession = await seedPaymentSession(t.prisma.db, m.id, { customerId: ada.id })
    const bobSession = await seedPaymentSession(t.prisma.db, m.id, { customerId: bob.id })
    const mine = await seedInvoice(m.id, adaSession.id)
    await seedInvoice(m.id, bobSession.id)
    await seedInvoice(m.id, null)

    const res = await get(k.secretKey, `/v1/invoices?customerId=${ada.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([mine.id])
  })

  it.each([
    '/v1/payment-sessions',
    '/v1/subscriptions',
    '/v1/transactions',
    '/v1/refunds',
    '/v1/invoices',
  ])("%s shows nothing for another merchant's customer", async (path) => {
    const owner = await seedMerchant(t.prisma.db)
    const intruder = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, intruder.id, { scopes: SCOPES })
    const customer = await seedCustomer(t.prisma.db, owner.id)
    const session = await seedPaymentSession(t.prisma.db, owner.id, { customerId: customer.id })
    const tx = await seedTransaction(t.prisma.db, owner.id, { customerId: customer.id })
    await seedSubscription(t.prisma.db, owner.id, { customerId: customer.id })
    await seedRefund(owner.id, tx.id)
    await seedInvoice(owner.id, session.id)

    const res = await get(k.secretKey, `${path}?customerId=${customer.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([])
  })

  it('refuses a malformed customer id with 400', async () => {
    const { k } = await world()

    const res = await get(
      k.secretKey,
      `/v1/payment-sessions?customerId=${encodeURIComponent('bad id;')}`,
    )

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('invalid_request')
  })

  it('finds a customer by wallet address in any letter case', async () => {
    const { m, k } = await world()
    const wallet = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
    const found = await seedCustomer(t.prisma.db, m.id, { walletAddress: wallet.toLowerCase() })

    const res = await get(k.secretKey, `/v1/customers?walletAddress=${wallet}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([found.id])
  })

  it('refuses a malformed wallet address with 400', async () => {
    const { k } = await world()

    const res = await get(k.secretKey, '/v1/customers?walletAddress=0x123')

    expect(res.statusCode).toBe(400)
  })
})
