import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { PaymentSessionStatus } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedPaymentSession } from '../helpers/fixtures.js'

describe('payment sessions e2e', () => {
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

  async function transition(action: 'cancel' | 'expire', from: PaymentSessionStatus) {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    const session = await seedPaymentSession(t.prisma.db, m.id, { status: from })
    const res = await t.inject({
      method: 'POST',
      url: `/v1/payment-sessions/${session.id}/${action}`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    const row = await t.prisma.db.paymentSession.findUniqueOrThrow({ where: { id: session.id } })
    return { statusCode: res.statusCode, body: res.body, status: row.status }
  }

  it.each(['created', 'awaiting_payment'] as const)('cancels a session in %s', async (from) => {
    const r = await transition('cancel', from)
    expect(r.statusCode).toBe(201)
    expect(r.status).toBe('cancelled')
  })

  it.each(['created', 'awaiting_payment'] as const)('expires a session in %s', async (from) => {
    const r = await transition('expire', from)
    expect(r.statusCode).toBe(201)
    expect(r.status).toBe('expired')
  })

  it.each([
    ['cancel', 'submitted'],
    ['cancel', 'confirmed'],
    ['cancel', 'expired'],
    ['cancel', 'cancelled'],
    ['cancel', 'failed'],
    ['expire', 'submitted'],
    ['expire', 'confirmed'],
    ['expire', 'cancelled'],
    ['expire', 'expired'],
    ['expire', 'failed'],
  ] as const)('refuses to %s a session in %s', async (action, from) => {
    const r = await transition(action, from)
    expect(r.statusCode).toBe(403)
    expect(r.body).toContain('session_invalid_state')
    expect(r.status).toBe(from)
  })

  it('answers a decimal amount with a 400 validation error', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    const res = await t.inject({
      method: 'POST',
      url: '/v1/payment-sessions',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { amount: '1.5', currency: 'USDC' },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toMatchObject({ code: 'invalid_request', param: 'amount' })
    expect(await t.prisma.db.paymentSession.count()).toBe(0)
  })

  it('returns 404 for another merchant’s session', async () => {
    const owner = await seedMerchant(t.prisma.db)
    const intruder = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, intruder.id)
    const session = await seedPaymentSession(t.prisma.db, owner.id)
    const res = await t.inject({
      method: 'POST',
      url: `/v1/payment-sessions/${session.id}/cancel`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(res.statusCode).toBe(404)
  })
})
