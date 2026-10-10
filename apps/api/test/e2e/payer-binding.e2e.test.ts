import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedCustomer, seedMerchant, seedPaymentSession, seedPlan } from '../helpers/fixtures.js'

const PAYER = `0x${'d'.repeat(40)}`
const ATTACKER = `0x${'a'.repeat(40)}`

describe('payer binding e2e', () => {
  let t: TestApp
  let ipCounter = 0
  let remoteAddress = '198.51.101.0'

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.email.reset()
    ipCounter += 1
    remoteAddress = `198.51.101.${ipCounter}`
  })

  const attachSession = (sessionId: string, body: { email: string; walletAddress: string }) =>
    t.inject({
      method: 'POST',
      url: `/v1/checkout/sessions/${sessionId}/payer`,
      payload: body,
      remoteAddress,
    })

  const attachPlan = (planId: string, body: { email: string; walletAddress: string }) =>
    t.inject({
      method: 'POST',
      url: `/v1/checkout/plans/${planId}/payer`,
      payload: body,
      remoteAddress,
    })

  async function merchantWithOpenSession() {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
    const session = await seedPaymentSession(t.prisma.db, m.id)
    return { m, session }
  }

  describe('POST /v1/checkout/sessions/:id/payer', () => {
    it('refuses to rebind a session whose payer is already attached to another wallet', async () => {
      const { session } = await merchantWithOpenSession()
      const first = await attachSession(session.id, {
        email: 'payer@buyer.test',
        walletAddress: PAYER,
      })
      expect(first.statusCode).toBe(201)
      const boundTo = JSON.parse(first.body).customerId as string

      const second = await attachSession(session.id, {
        email: 'attacker@evil.test',
        walletAddress: ATTACKER,
      })

      expect(second.statusCode).toBe(409)
      expect(JSON.parse(second.body).error.code).toBe('payer_already_bound')
      const row = await t.prisma.db.paymentSession.findUniqueOrThrow({ where: { id: session.id } })
      expect(row.customerId).toBe(boundTo)
    })

    it('lets the same wallet attach again while the session is open', async () => {
      const { session } = await merchantWithOpenSession()
      const body = { email: 'payer@buyer.test', walletAddress: PAYER }
      const first = await attachSession(session.id, body)
      const again = await attachSession(session.id, body)

      expect(first.statusCode).toBe(201)
      expect(again.statusCode).toBe(201)
      expect(JSON.parse(again.body).customerId).toBe(JSON.parse(first.body).customerId)
    })

    it('refuses to attach a payer to a confirmed session', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      const session = await seedPaymentSession(t.prisma.db, m.id, { status: 'confirmed' })

      const res = await attachSession(session.id, {
        email: 'attacker@evil.test',
        walletAddress: ATTACKER,
      })

      expect(res.statusCode).toBe(409)
      expect(JSON.parse(res.body).error.code).toBe('session_not_open')
      const row = await t.prisma.db.paymentSession.findUniqueOrThrow({ where: { id: session.id } })
      expect(row.customerId).toBeNull()
    })

    it('refuses to attach a payer to a session past its expiry', async () => {
      const { session } = await merchantWithOpenSession()
      await t.prisma.db.paymentSession.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      })

      const res = await attachSession(session.id, {
        email: 'payer@buyer.test',
        walletAddress: PAYER,
      })

      expect(res.statusCode).toBe(409)
      expect(JSON.parse(res.body).error.code).toBe('session_not_open')
    })

    it('does not overwrite the email of a customer the merchant already knows', async () => {
      const { m, session } = await merchantWithOpenSession()
      const known = await seedCustomer(t.prisma.db, m.id, {
        email: 'victim@buyer.test',
        walletAddress: PAYER,
      })

      const res = await attachSession(session.id, {
        email: 'attacker@evil.test',
        walletAddress: PAYER,
      })

      expect(res.statusCode).toBe(201)
      const row = await t.prisma.db.customer.findUniqueOrThrow({ where: { id: known.id } })
      expect(row.email).toBe('victim@buyer.test')
    })

    it('refuses another wallet on a session the merchant created for its own customer', async () => {
      const { m, session } = await merchantWithOpenSession()
      const owner = await seedCustomer(t.prisma.db, m.id, {
        email: 'owner@buyer.test',
        walletAddress: PAYER,
      })
      await t.prisma.db.paymentSession.update({
        where: { id: session.id },
        data: { customerId: owner.id },
      })

      const res = await attachSession(session.id, {
        email: 'attacker@evil.test',
        walletAddress: ATTACKER,
      })

      expect(res.statusCode).toBe(409)
      expect(JSON.parse(res.body).error.code).toBe('payer_already_bound')
      const row = await t.prisma.db.paymentSession.findUniqueOrThrow({ where: { id: session.id } })
      expect(row.customerId).toBe(owner.id)
    })

    it('does not extend the email history with a refused email change', async () => {
      const { m, session } = await merchantWithOpenSession()
      const history = [{ email: 'victim@buyer.test', seenAt: '2026-01-01T00:00:00.000Z' }]
      const known = await t.prisma.db.customer.create({
        data: {
          merchantId: m.id,
          walletAddress: PAYER,
          email: 'victim@buyer.test',
          metadata: { emailHistory: history },
        },
      })

      const res = await attachSession(session.id, {
        email: 'attacker@evil.test',
        walletAddress: PAYER,
      })

      expect(res.statusCode).toBe(201)
      const row = await t.prisma.db.customer.findUniqueOrThrow({ where: { id: known.id } })
      expect(row.metadata).toEqual({ emailHistory: history })
    })

    it('fills the email of a known customer who has none', async () => {
      const { m, session } = await merchantWithOpenSession()
      const known = await t.prisma.db.customer.create({
        data: { merchantId: m.id, walletAddress: PAYER, email: null },
      })

      const res = await attachSession(session.id, {
        email: 'payer@buyer.test',
        walletAddress: PAYER,
      })

      expect(res.statusCode).toBe(201)
      expect(JSON.parse(res.body).customerId).toBe(known.id)
      const row = await t.prisma.db.customer.findUniqueOrThrow({ where: { id: known.id } })
      expect(row.email).toBe('payer@buyer.test')
    })
  })

  describe('POST /v1/checkout/plans/:id/payer', () => {
    it('refuses an archived plan', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      const plan = await seedPlan(t.prisma.db, m.id, { status: 'archived' })

      const res = await attachPlan(plan.id, { email: 'payer@buyer.test', walletAddress: PAYER })

      expect(res.statusCode).toBe(409)
      expect(JSON.parse(res.body).error.code).toBe('plan_not_active')
      const customers = await t.prisma.db.customer.count({ where: { merchantId: m.id } })
      expect(customers).toBe(0)
    })

    it('does not overwrite the email of a customer the merchant already knows', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      const plan = await seedPlan(t.prisma.db, m.id)
      const known = await seedCustomer(t.prisma.db, m.id, {
        email: 'victim@buyer.test',
        walletAddress: PAYER,
      })

      const res = await attachPlan(plan.id, { email: 'attacker@evil.test', walletAddress: PAYER })

      expect(res.statusCode).toBe(201)
      const row = await t.prisma.db.customer.findUniqueOrThrow({ where: { id: known.id } })
      expect(row.email).toBe('victim@buyer.test')
    })
  })
})
