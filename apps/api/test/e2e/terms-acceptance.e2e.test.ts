import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TERMS_VERSION } from '@strimz/shared-config'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { must } from '../helpers/must.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

const IP = '198.51.100.23'

describe('terms acceptance (ADR-2026-11-21-terms-acceptance)', () => {
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

  const onboarding = (acceptedTerms?: string) => ({
    businessName: 'Acme Inc',
    businessSector: 'Software',
    countryCode: 'NG',
    payoutAddress: `0x${'a'.repeat(40)}`,
    ...(acceptedTerms === undefined ? {} : { acceptedTerms }),
  })
  const onboard = (token: string, acceptedTerms?: string) =>
    t.inject({
      method: 'POST',
      url: '/v1/merchants/me/onboard',
      remoteAddress: IP,
      headers: { authorization: `Bearer ${token}` },
      payload: onboarding(acceptedTerms),
    })
  const errorOf = (body: string) =>
    (JSON.parse(body) as { error: { code: string; details?: { version?: string } } }).error

  describe('onboarding', () => {
    it.each([
      ['without ticking the box', undefined],
      ['with an old version', '2020-01-01'],
    ])('is refused %s', async (_label, acceptedTerms) => {
      const m = await seedMerchant(t.prisma.db, { termsVersion: null })

      const res = await onboard(m.privyAccessToken, acceptedTerms)

      expect(res.statusCode).toBe(400)
      expect(errorOf(res.body)).toMatchObject({
        code: 'terms_required',
        details: { version: TERMS_VERSION },
      })
      const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
      expect(row.onboardingCompleted).toBe(false)
      expect(row.termsVersion).toBeNull()
    })

    it('records the version, the time and the IP, and audits it', async () => {
      const m = await seedMerchant(t.prisma.db, { termsVersion: null })

      const res = await onboard(m.privyAccessToken, TERMS_VERSION)

      expect(res.statusCode).toBe(201)
      const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
      expect(row).toMatchObject({ termsVersion: TERMS_VERSION, termsAcceptedIp: IP })
      expect(row.termsAcceptedAt).not.toBeNull()
      const log = await t.prisma.db.auditLog.findFirstOrThrow({
        where: { action: 'terms.accepted' },
      })
      expect(log).toMatchObject({ merchantId: m.id, targetId: m.id })
      expect(log.metadata).toMatchObject({ version: TERMS_VERSION })
    })
  })

  describe('dashboard changes after the terms change', () => {
    const rename = (token: string) =>
      t.inject({
        method: 'PATCH',
        url: '/v1/merchants/me',
        headers: { authorization: `Bearer ${token}` },
        payload: { businessName: 'Renamed Ltd' },
      })

    it('refuses a change until the current terms are accepted, but still lets the merchant look', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        termsVersion: '2020-01-01',
      })

      const write = await rename(m.privyAccessToken)
      const read = await t.inject({
        method: 'GET',
        url: '/v1/merchants/me',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
      })

      expect(write.statusCode).toBe(403)
      expect(errorOf(write.body)).toMatchObject({
        code: 'terms_required',
        details: { version: TERMS_VERSION },
      })
      expect(read.statusCode).toBe(200)
      expect(JSON.parse(read.body)).toMatchObject({ termsVersion: '2020-01-01' })
    })

    it('lets changes through again once the merchant accepts', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        termsVersion: '2020-01-01',
      })

      const accept = await t.inject({
        method: 'POST',
        url: '/v1/merchants/me/terms',
        remoteAddress: IP,
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { version: TERMS_VERSION },
      })

      expect(accept.statusCode).toBe(200)
      expect(JSON.parse(accept.body)).toMatchObject({ termsVersion: TERMS_VERSION })
      expect((await rename(m.privyAccessToken)).statusCode).toBe(200)
      const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
      expect(must(row.termsAcceptedIp)).toBe(IP)
    })

    it('only accepts the current version', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, termsVersion: null })

      const res = await t.inject({
        method: 'POST',
        url: '/v1/merchants/me/terms',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { version: '2020-01-01' },
      })

      expect(res.statusCode).toBe(400)
      expect(errorOf(res.body).code).toBe('terms_required')
    })

    it("never blocks a merchant's API key, so their customers can still pay", async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        termsVersion: null,
        walletAddress: `0x${'c'.repeat(40)}`,
        onchainMerchantId: 1,
      })
      const key = await seedApiKey(t.prisma.db, m.id)

      const res = await t.inject({
        method: 'POST',
        url: '/v1/payment-sessions',
        headers: { authorization: `Bearer ${key.secretKey}` },
        payload: { amount: '1000000', currency: 'USDC' },
      })

      expect(res.statusCode).toBe(201)
    })
  })
})
