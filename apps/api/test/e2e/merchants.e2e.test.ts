import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'

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
      },
    })
    expect(res.statusCode).toBe(201)

    const row = await t.prisma.db.merchant.findUnique({ where: { id: m.id } })
    expect(row!.onboardingCompleted).toBe(true)
    expect(row!.businessSector).toBe('Software')
  })

  it('GET /v1/merchants/me/live-mode-eligibility surfaces blocking reasons', async () => {
    const m = await seedMerchant(t.prisma.db, {
      emailVerified: false,
      twoFactorEnabled: false,
      onboardingCompleted: false,
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
    expect(codes).toContain('email_unverified')
    expect(codes).toContain('mfa_required')
    expect(codes).toContain('onboarding_incomplete')
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
