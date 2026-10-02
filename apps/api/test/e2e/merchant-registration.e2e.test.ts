import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { QUEUE_NAMES, relayJobSchema } from '@strimz/queue-contracts'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'
import { must } from '../helpers/must.js'

const WALLET = '0x00000000000000000000000000000000000000c1'

describe('merchant on-chain registration requests', () => {
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

  const relayJobs = () => t.queue.jobsFor(QUEUE_NAMES.relaySubmission)

  const createSession = (secretKey: string) =>
    t.inject({
      method: 'POST',
      url: '/v1/payment-sessions',
      headers: { authorization: `Bearer ${secretKey}` },
      payload: { amount: '1000000', currency: 'USDC' },
    })

  it('returns sessions at once and requests exactly one registration under concurrency', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, walletAddress: WALLET })
    const k = await seedApiKey(t.prisma.db, m.id)

    const responses = await Promise.all([1, 2, 3].map(() => createSession(k.secretKey)))
    expect(responses.map((r) => r.statusCode)).toEqual([201, 201, 201])
    for (const r of responses) expect(JSON.parse(r.body).chainMerchantId).toBeNull()

    const jobs = relayJobs()
    expect(jobs.length).toBeGreaterThan(0)
    const jobIds = new Set(jobs.map((j) => (j.opts as { jobId?: string }).jobId))
    expect([...jobIds]).toEqual([`merchant-register:${m.id}`])
    const parsed = relayJobSchema.parse(must(jobs[0]).data)
    expect(parsed).toMatchObject({ reason: 'registerMerchant', merchantInternalId: m.id })

    const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
    expect(row.onchainRegistrationRequestedAt).not.toBeNull()
  })

  it('still refuses an ineligible merchant with 412 and enqueues nothing', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true })
    const k = await seedApiKey(t.prisma.db, m.id)
    const res = await createSession(k.secretKey)
    expect(res.statusCode).toBe(412)
    expect(relayJobs()).toHaveLength(0)
  })

  it('enqueues nothing for a merchant that is already registered', async () => {
    const m = await seedMerchant(t.prisma.db, {
      onboardingCompleted: true,
      walletAddress: WALLET,
      onchainMerchantId: 9,
    })
    const k = await seedApiKey(t.prisma.db, m.id)
    const res = await createSession(k.secretKey)
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).chainMerchantId).toBe('9')
    expect(relayJobs()).toHaveLength(0)
  })

  it('creates plans and invoices for an unregistered merchant without waiting', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, walletAddress: WALLET })
    const k = await seedApiKey(t.prisma.db, m.id)
    const plan = await t.inject({
      method: 'POST',
      url: '/v1/subscription-plans',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { name: 'Pro', amount: '20000000', currency: 'USDC', interval: 'monthly' },
    })
    expect(plan.statusCode).toBe(201)
    expect(JSON.parse(plan.body).chainMerchantId).toBeNull()

    const invoice = await t.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        currency: 'USDC',
        lineItems: [{ description: 'X', quantity: 1, unitAmount: '50000000' }],
      },
    })
    expect(invoice.statusCode).toBe(201)
  })

  it('starts registration when an eligible merchant finishes onboarding', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: false, walletAddress: WALLET })
    const res = await t.inject({
      method: 'POST',
      url: '/v1/merchants/me/onboard',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: {
        businessName: 'Acme Inc',
        businessSector: 'Software',
        countryCode: 'US',
        payoutAddress: '0x' + 'a'.repeat(40),
      },
    })
    expect(res.statusCode).toBe(201)
    const jobs = relayJobs()
    expect(jobs).toHaveLength(1)
    expect((must(jobs[0]).opts as { jobId?: string }).jobId).toBe(`merchant-register:${m.id}`)
  })

  it('finishes onboarding without a registration when the wallet is missing', async () => {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: false })
    const res = await t.inject({
      method: 'POST',
      url: '/v1/merchants/me/onboard',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: {
        businessName: 'Acme Inc',
        businessSector: 'Software',
        countryCode: 'US',
        payoutAddress: '0x' + 'a'.repeat(40),
      },
    })
    expect(res.statusCode).toBe(201)
    expect(relayJobs()).toHaveLength(0)
  })
})
