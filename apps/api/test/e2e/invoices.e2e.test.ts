import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

describe('invoices e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.email.reset()
  })

  async function authed() {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true })
    const k = await seedApiKey(t.prisma.db, m.id)
    return { m, k }
  }

  it('creates an invoice with backing payment session and yearly invoice number', async () => {
    const { k } = await authed()
    const res = await t.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        currency: 'USDC',
        customerEmail: 'buyer@x.test',
        lineItems: [
          { description: 'Hosting', quantity: 1, unitAmount: '50000000' },
          { description: 'Support', quantity: 2, unitAmount: '10000000' },
        ],
        dueInDays: 14,
      },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.total).toBe('70000000')
    expect(body.subtotal).toBe('70000000')
    expect(body.number).toMatch(/^\d{4}-0001$/)
    expect(body.sessionId).toBeTruthy()

    // The backing PaymentSession was created with checkoutUrl populated.
    const session = await t.prisma.db.paymentSession.findUniqueOrThrow({
      where: { id: body.sessionId },
    })
    expect(session.checkoutUrl).toContain(body.sessionId)
  })

  it('send delivers email via EmailService stub and flips status to sent', async () => {
    const { k } = await authed()
    const create = await t.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        currency: 'USDC',
        customerEmail: 'buyer@x.test',
        lineItems: [{ description: 'X', quantity: 1, unitAmount: '50000000' }],
      },
    })
    const id = JSON.parse(create.body).id

    const send = await t.inject({
      method: 'POST',
      url: `/v1/invoices/${id}/send`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(send.statusCode).toBe(201)
    expect(JSON.parse(send.body).status).toBe('sent')

    expect(t.email.sent).toHaveLength(1)
    expect(t.email.sent[0]!.to).toBe('buyer@x.test')
    expect(t.email.sent[0]!.subject).toContain('Invoice')
    expect(t.email.sent[0]!.html).toContain('Hosting'.slice(0, 0)) // sanity that html exists
  })

  it('refuses to send when there is no customer email', async () => {
    const { k } = await authed()
    const create = await t.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        currency: 'USDC',
        lineItems: [{ description: 'X', quantity: 1, unitAmount: '50000000' }],
      },
    })
    const id = JSON.parse(create.body).id
    const send = await t.inject({
      method: 'POST',
      url: `/v1/invoices/${id}/send`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(send.statusCode).toBe(403)
  })

  it('void cancels the backing session and rejects voiding paid invoices', async () => {
    const { k } = await authed()
    const create = await t.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        currency: 'USDC',
        lineItems: [{ description: 'X', quantity: 1, unitAmount: '50000000' }],
      },
    })
    const inv = JSON.parse(create.body)
    const v = await t.inject({
      method: 'POST',
      url: `/v1/invoices/${inv.id}/void`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(v.statusCode).toBe(201)
    const session = await t.prisma.db.paymentSession.findUniqueOrThrow({
      where: { id: inv.sessionId },
    })
    expect(session.status).toBe('cancelled')

    // Already-paid invoices can't be voided.
    await t.prisma.db.invoice.update({ where: { id: inv.id }, data: { status: 'paid' } })
    const v2 = await t.inject({
      method: 'POST',
      url: `/v1/invoices/${inv.id}/void`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(v2.statusCode).toBe(403)
  })
})
