import { TERMS_VERSION } from '@strimz/shared-config'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { must } from '../helpers/must.js'

describe('merchants e2e', () => {
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

  it('GET /v1/merchants/me returns the authenticated merchant', async () => {
    const m = await seedMerchant(t.prisma.db, { email: 'me@acme.test' })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/merchants/me',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).email).toBe('me@acme.test')
  })

  it('PATCH /v1/merchants/me updates allowed fields', async () => {
    const m = await seedMerchant(t.prisma.db)
    const res = await t.inject({
      method: 'PATCH',
      url: '/v1/merchants/me',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: { businessName: 'New Name' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).businessName).toBe('New Name')
  })

  // The Registry pays the on-chain payout address; after registration only the
  // 24-hour on-chain rotation may change it, and the indexer mirrors it here.
  it('refuses a payout change for a merchant registered on chain', async () => {
    const onchain = '0x' + '2'.repeat(40)
    const m = await seedMerchant(t.prisma.db, { onchainMerchantId: 77, payoutAddress: onchain })
    const res = await t.inject({
      method: 'PATCH',
      url: '/v1/merchants/me',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: { payoutAddress: '0x' + '3'.repeat(40) },
    })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error.code).toBe('payout_change_onchain')
    const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
    expect(row.payoutAddress).toBe(onchain)
  })

  it('refuses an onboarding resubmission that changes a registered payout address', async () => {
    const onchain = '0x' + '2'.repeat(40)
    const m = await seedMerchant(t.prisma.db, { onchainMerchantId: 78, payoutAddress: onchain })
    const res = await t.inject({
      method: 'POST',
      url: '/v1/merchants/me/onboard',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: {
        businessName: 'Acme Inc',
        businessSector: 'Software',
        countryCode: 'US',
        payoutAddress: '0x' + '4'.repeat(40),
        acceptedTerms: TERMS_VERSION,
      },
    })

    expect(res.statusCode).toBe(409)
    const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
    expect(row.payoutAddress).toBe(onchain)
  })

  it('still lets an unregistered merchant set its payout address', async () => {
    const m = await seedMerchant(t.prisma.db)
    const res = await t.inject({
      method: 'PATCH',
      url: '/v1/merchants/me',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: { payoutAddress: '0x' + '5'.repeat(40) },
    })
    expect(res.statusCode).toBe(200)
  })

  it('POST /v1/merchants/me/onboard flips onboardingCompleted', async () => {
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
        acceptedTerms: TERMS_VERSION,
      },
    })
    expect(res.statusCode).toBe(201)

    const row = await t.prisma.db.merchant.findUnique({ where: { id: m.id } })
    expect(must(row).onboardingCompleted).toBe(true)
    expect(must(row).businessSector).toBe('Software')
  })

  it('GET /v1/merchants/me/live-mode-eligibility surfaces blocking reasons', async () => {
    const m = await seedMerchant(t.prisma.db, {
      twoFactorEnabled: false,
      onboardingCompleted: false,
      passkey: false,
    })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/merchants/me/live-mode-eligibility',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.eligible).toBe(false)
    const codes = body.reasons.map((r: { code: string }) => r.code).sort()
    expect(codes).toContain('mfa_required')
    expect(codes).toContain('onboarding_incomplete')
  })

  it('corrects stale flags from Privy before refusing (#548)', async () => {
    // A passkey enrolled right after Privy's link webhook leaves twoFactorEnabled stale, and
    // Google sign-ins used to be stored as unverified.
    const m = await seedMerchant(t.prisma.db, {
      emailVerified: false,
      twoFactorEnabled: false,
      onboardingCompleted: true,
      payoutAddress: '0x' + '1'.repeat(40),
      passkey: true,
    })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/merchants/me/live-mode-eligibility',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ eligible: true, reasons: [] })
    const row = must(await t.prisma.db.merchant.findUnique({ where: { id: m.id } }))
    expect(row.emailVerified).toBe(true)
    expect(row.twoFactorEnabled).toBe(true)
  })

  it('GET /v1/merchants/me/live-mode-eligibility returns eligible=true when all gates clear', async () => {
    const m = await seedMerchant(t.prisma.db, {
      emailVerified: true,
      twoFactorEnabled: true,
      onboardingCompleted: true,
      payoutAddress: '0x' + '1'.repeat(40),
    })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/merchants/me/live-mode-eligibility',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.eligible).toBe(true)
    expect(body.reasons).toEqual([])
  })
})
