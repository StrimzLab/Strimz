import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { apiKeyScopeSchema } from '@strimz/shared-types'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

type Method = 'GET' | 'POST' | 'PATCH'

interface RouteCase {
  method: Method
  url: string
  payload?: Record<string, unknown>
}

const storefrontPayload = {
  slug: 'acme-shop',
  name: 'Acme Shop',
  description: 'Quality widgets.',
  logoUrl: null,
  coverImageUrl: null,
  accentColor: null,
  socialLinks: [],
}

const productPayload = {
  name: 'Widget',
  description: null,
  price: '5000000',
  currency: 'USDC',
  type: 'one_time',
  interval: null,
  intervalCount: null,
  stock: null,
  isActive: true,
}

const unscopedRoutes: RouteCase[] = [
  { method: 'GET', url: '/v1/merchants/me' },
  { method: 'PATCH', url: '/v1/merchants/me', payload: { payoutAddress: '0x' + 'e'.repeat(40) } },
  {
    method: 'POST',
    url: '/v1/merchants/me/onboard',
    payload: {
      businessName: 'Attacker Inc',
      businessSector: 'Software',
      countryCode: 'US',
      payoutAddress: '0x' + 'e'.repeat(40),
    },
  },
  { method: 'POST', url: '/v1/merchants/me/tier', payload: { tier: 'enterprise' } },
  { method: 'GET', url: '/v1/merchants/me/live-mode-eligibility' },
  { method: 'GET', url: '/v1/merchants/me/chain-status' },
  { method: 'GET', url: '/v1/merchants/me/onchain-state' },
  { method: 'GET', url: '/v1/merchants/me/balance' },
  { method: 'POST', url: '/v1/customers', payload: { walletAddress: '0x' + 'c'.repeat(40) } },
  { method: 'GET', url: '/v1/customers' },
  { method: 'GET', url: '/v1/customers/cus_missing' },
  { method: 'GET', url: '/v1/stats/conversion' },
  { method: 'GET', url: '/v1/stats/churn' },
  { method: 'GET', url: '/v1/stats/mrr' },
  { method: 'GET', url: '/v1/stats/ltv' },
  { method: 'GET', url: '/v1/stats/forecast' },
  { method: 'GET', url: '/v1/notifications' },
  { method: 'POST', url: '/v1/notifications/mark-all-read' },
  { method: 'GET', url: '/v1/storefront' },
  { method: 'POST', url: '/v1/storefront', payload: storefrontPayload },
  { method: 'POST', url: '/v1/storefront/publish' },
  { method: 'POST', url: '/v1/storefront/archive' },
  { method: 'GET', url: '/v1/storefront/products' },
  { method: 'POST', url: '/v1/storefront/products', payload: productPayload },
  { method: 'GET', url: '/v1/storefront/products/prod_missing' },
  { method: 'POST', url: '/v1/storefront/products/prod_missing/archive' },
]

const allScopes = [...apiKeyScopeSchema.options]

const newScopes = ['merchants_read', 'customers_read', 'customers_write', 'analytics_read']
const preEnforcementScopes = allScopes.filter((s) => !newScopes.includes(s))

const sessionOnlyRoutes: RouteCase[] = [
  { method: 'PATCH', url: '/v1/merchants/me', payload: { businessName: 'Renamed' } },
  {
    method: 'POST',
    url: '/v1/merchants/me/onboard',
    payload: {
      businessName: 'Acme Co',
      businessSector: 'Software',
      countryCode: 'US',
      payoutAddress: '0x' + 'e'.repeat(40),
    },
  },
  { method: 'POST', url: '/v1/merchants/me/tier', payload: { tier: 'enterprise' } },
  { method: 'GET', url: '/v1/notifications' },
  { method: 'POST', url: '/v1/notifications/mark-all-read' },
]

const backfillSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../packages/db/prisma/migrations/20261003120100_api_key_full_access_scope_backfill/migration.sql',
  ),
  'utf8',
)

describe('api key scope enforcement e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.chain.environment = 'testnet'
  })

  describe('routes without a declared scope reject an unrelated API key', () => {
    it.each(unscopedRoutes)('$method $url', async ({ method, url, payload }) => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: false })
      const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['sessions_read'] })
      const res = await t.inject({
        method,
        url,
        headers: { authorization: `Bearer ${k.secretKey}` },
        ...(payload ? { payload } : {}),
      })
      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('permission_denied')
    })
  })

  it('an API key cannot change the payout address the merchant set', async () => {
    const original = '0x000000000000000000000000000000000000beef'
    const m = await seedMerchant(t.prisma.db, { payoutAddress: original })
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['sessions_read'] })
    await t.inject({
      method: 'PATCH',
      url: '/v1/merchants/me',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { payoutAddress: '0x' + 'e'.repeat(40) },
    })
    const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
    expect(row.payoutAddress).toBe(original)
  })

  it('the dashboard session still reaches a session route', async () => {
    const m = await seedMerchant(t.prisma.db)
    const res = await t.inject({
      method: 'GET',
      url: '/v1/merchants/me',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(res.statusCode).toBe(200)
  })

  describe('minting keys with an API key', () => {
    it('rejects granting a scope the calling key does not hold', async () => {
      const m = await seedMerchant(t.prisma.db)
      const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['api_keys_write'] })
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${k.secretKey}` },
        payload: { name: 'escalated', kind: 'secret', mode: 'test', scopes: ['refunds_write'] },
      })
      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('permission_denied')
    })

    it('allows granting a subset of the calling key scopes in its own mode', async () => {
      const m = await seedMerchant(t.prisma.db)
      const k = await seedApiKey(t.prisma.db, m.id, {
        scopes: ['api_keys_write', 'sessions_read', 'sessions_write'],
      })
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${k.secretKey}` },
        payload: { name: 'narrow', kind: 'secret', mode: 'test', scopes: ['sessions_read'] },
      })
      expect(res.statusCode).toBe(201)
    })

    it('rejects a test-mode key minting a live-mode key', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        twoFactorEnabled: true,
      })
      const k = await seedApiKey(t.prisma.db, m.id, { mode: 'test', scopes: allScopes })
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${k.secretKey}` },
        payload: { name: 'live', kind: 'secret', mode: 'live', scopes: ['sessions_read'] },
      })
      expect(res.statusCode).toBe(403)
    })

    it('rejects a test-mode key rotating a live-mode key', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        twoFactorEnabled: true,
      })
      const live = await seedApiKey(t.prisma.db, m.id, { mode: 'live', scopes: allScopes })
      const k = await seedApiKey(t.prisma.db, m.id, { mode: 'test', scopes: allScopes })
      const res = await t.inject({
        method: 'POST',
        url: `/v1/api-keys/${live.id}/rotate`,
        headers: { authorization: `Bearer ${k.secretKey}` },
      })
      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.body).error.code).toBe('not_found')
      const row = await t.prisma.db.merchantApiKey.findUniqueOrThrow({ where: { id: live.id } })
      expect(row.revokedAt).toBeNull()
    })
  })

  describe('live-mode eligibility on key minting', () => {
    beforeEach(() => {
      t.chain.environment = 'mainnet'
    })

    it('rejects a live key for a merchant that is not eligible', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: false,
        twoFactorEnabled: false,
      })
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { name: 'live', kind: 'secret', mode: 'live', scopes: ['sessions_read'] },
      })
      expect(res.statusCode).toBe(403)
      const body = JSON.parse(res.body)
      expect(body.error.code).toBe('live_mode_ineligible')
      expect(body.error.details.reasons.map((r: { code: string }) => r.code)).toEqual([
        'mfa_required',
        'onboarding_incomplete',
      ])
      const count = await t.prisma.db.merchantApiKey.count({ where: { merchantId: m.id } })
      expect(count).toBe(0)
    })

    it('mints a live key for an eligible merchant', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        twoFactorEnabled: true,
        emailVerified: true,
      })
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { name: 'live', kind: 'secret', mode: 'live', scopes: ['sessions_read'] },
      })
      expect(res.statusCode).toBe(201)
    })

    it('still mints a test key for a merchant that is not eligible', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: false,
        twoFactorEnabled: false,
      })
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { name: 'test', kind: 'secret', mode: 'test', scopes: ['sessions_read'] },
      })
      expect(res.statusCode).toBe(201)
    })
  })

  describe('session-only routes', () => {
    it.each(sessionOnlyRoutes)(
      'rejects $method $url for a key holding every scope',
      async ({ method, url, payload }) => {
        const m = await seedMerchant(t.prisma.db)
        const k = await seedApiKey(t.prisma.db, m.id, { scopes: allScopes })
        const res = await t.inject({
          method,
          url,
          headers: { authorization: `Bearer ${k.secretKey}` },
          ...(payload ? { payload } : {}),
        })
        expect(res.statusCode).toBe(403)
        const body = JSON.parse(res.body)
        expect(body.error.code).toBe('permission_denied')
        expect(body.error.message).toBe('route requires a dashboard session')
      },
    )

    it('still serves the dashboard session on session-only routes', async () => {
      const m = await seedMerchant(t.prisma.db)
      const auth = { authorization: `Bearer ${m.privyAccessToken}` }
      const patch = await t.inject({
        method: 'PATCH',
        url: '/v1/merchants/me',
        headers: auth,
        payload: { businessName: 'Renamed' },
      })
      expect(patch.statusCode).toBe(200)
      const notifications = await t.inject({
        method: 'GET',
        url: '/v1/notifications',
        headers: auth,
      })
      expect(notifications.statusCode).toBe(200)
      const markRead = await t.inject({
        method: 'POST',
        url: '/v1/notifications/mark-all-read',
        headers: auth,
      })
      expect(markRead.statusCode).toBe(201)
    })
  })

  describe('new scopes grant their routes', () => {
    it('merchants_read reads the merchant profile and status routes', async () => {
      const m = await seedMerchant(t.prisma.db)
      const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['merchants_read'] })
      const auth = { authorization: `Bearer ${k.secretKey}` }
      const me = await t.inject({ method: 'GET', url: '/v1/merchants/me', headers: auth })
      expect(me.statusCode).toBe(200)
      expect(JSON.parse(me.body).id).toBe(m.id)
      const eligibility = await t.inject({
        method: 'GET',
        url: '/v1/merchants/me/live-mode-eligibility',
        headers: auth,
      })
      expect(eligibility.statusCode).toBe(200)
    })

    it('customers_write creates and customers_read lists customers', async () => {
      const m = await seedMerchant(t.prisma.db)
      const writer = await seedApiKey(t.prisma.db, m.id, { scopes: ['customers_write'] })
      const reader = await seedApiKey(t.prisma.db, m.id, { scopes: ['customers_read'] })
      const created = await t.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${writer.secretKey}` },
        payload: { walletAddress: '0x' + 'c'.repeat(40) },
      })
      expect(created.statusCode).toBe(201)
      const listed = await t.inject({
        method: 'GET',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${reader.secretKey}` },
      })
      expect(listed.statusCode).toBe(200)
      expect(JSON.parse(listed.body).data).toHaveLength(1)
      const readerCannotWrite = await t.inject({
        method: 'POST',
        url: '/v1/customers',
        headers: { authorization: `Bearer ${reader.secretKey}` },
        payload: { walletAddress: '0x' + 'd'.repeat(40) },
      })
      expect(readerCannotWrite.statusCode).toBe(403)
    })

    it('analytics_read reads the stats routes', async () => {
      const m = await seedMerchant(t.prisma.db)
      const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['analytics_read'] })
      const res = await t.inject({
        method: 'GET',
        url: '/v1/stats/mrr',
        headers: { authorization: `Bearer ${k.secretKey}` },
      })
      expect(res.statusCode).toBe(200)
    })

    it('storefronts_write creates and storefronts_read reads the storefront', async () => {
      const m = await seedMerchant(t.prisma.db)
      const writer = await seedApiKey(t.prisma.db, m.id, { scopes: ['storefronts_write'] })
      const reader = await seedApiKey(t.prisma.db, m.id, { scopes: ['storefronts_read'] })
      const created = await t.inject({
        method: 'POST',
        url: '/v1/storefront',
        headers: { authorization: `Bearer ${writer.secretKey}` },
        payload: storefrontPayload,
      })
      expect(created.statusCode).toBe(201)
      const read = await t.inject({
        method: 'GET',
        url: '/v1/storefront',
        headers: { authorization: `Bearer ${reader.secretKey}` },
      })
      expect(read.statusCode).toBe(200)
      expect(JSON.parse(read.body).slug).toBe(storefrontPayload.slug)
    })
  })

  describe('key management stays inside the calling key mode', () => {
    it('hides live keys from a test key on list, retrieve and revoke', async () => {
      const m = await seedMerchant(t.prisma.db)
      const live = await seedApiKey(t.prisma.db, m.id, { mode: 'live', scopes: allScopes })
      const k = await seedApiKey(t.prisma.db, m.id, { mode: 'test', scopes: allScopes })
      const auth = { authorization: `Bearer ${k.secretKey}` }

      const list = await t.inject({ method: 'GET', url: '/v1/api-keys', headers: auth })
      expect(list.statusCode).toBe(200)
      expect(JSON.parse(list.body).data.map((r: { id: string }) => r.id)).toEqual([k.id])

      const retrieve = await t.inject({
        method: 'GET',
        url: `/v1/api-keys/${live.id}`,
        headers: auth,
      })
      expect(retrieve.statusCode).toBe(404)

      const revoke = await t.inject({
        method: 'POST',
        url: `/v1/api-keys/${live.id}/revoke`,
        headers: auth,
      })
      expect(revoke.statusCode).toBe(404)
      const row = await t.prisma.db.merchantApiKey.findUniqueOrThrow({ where: { id: live.id } })
      expect(row.revokedAt).toBeNull()
    })

    it('rejects rotating a key that holds scopes the calling key lacks', async () => {
      const m = await seedMerchant(t.prisma.db)
      const wide = await seedApiKey(t.prisma.db, m.id, { scopes: ['refunds_write'] })
      const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['api_keys_write'] })
      const res = await t.inject({
        method: 'POST',
        url: `/v1/api-keys/${wide.id}/rotate`,
        headers: { authorization: `Bearer ${k.secretKey}` },
      })
      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('permission_denied')
      const row = await t.prisma.db.merchantApiKey.findUniqueOrThrow({ where: { id: wide.id } })
      expect(row.revokedAt).toBeNull()
    })

    it('rotates a key whose scopes the calling key holds', async () => {
      const m = await seedMerchant(t.prisma.db)
      const narrow = await seedApiKey(t.prisma.db, m.id, { scopes: ['sessions_read'] })
      const k = await seedApiKey(t.prisma.db, m.id, {
        scopes: ['api_keys_write', 'sessions_read'],
      })
      const res = await t.inject({
        method: 'POST',
        url: `/v1/api-keys/${narrow.id}/rotate`,
        headers: { authorization: `Bearer ${k.secretKey}` },
      })
      expect(res.statusCode).toBe(201)
      expect(JSON.parse(res.body).apiKey.scopes).toEqual(['sessions_read'])
    })

    it('lets a dashboard session list keys of both modes', async () => {
      const m = await seedMerchant(t.prisma.db)
      await seedApiKey(t.prisma.db, m.id, { mode: 'live' })
      await seedApiKey(t.prisma.db, m.id, { mode: 'test' })
      const res = await t.inject({
        method: 'GET',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
      })
      expect(res.statusCode).toBe(200)
      expect(JSON.parse(res.body).data).toHaveLength(2)
    })
  })

  describe('live minting while no mainnet deployment is configured', () => {
    it('rejects a live key for an eligible merchant with live_mode_unavailable', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        twoFactorEnabled: true,
        emailVerified: true,
      })
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
        payload: { name: 'live', kind: 'secret', mode: 'live', scopes: ['sessions_read'] },
      })
      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('live_mode_unavailable')
      expect(await t.prisma.db.merchantApiKey.count({ where: { merchantId: m.id } })).toBe(0)
    })

    it('rejects rotating a live key with live_mode_unavailable and keeps it active', async () => {
      const m = await seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        twoFactorEnabled: true,
        emailVerified: true,
      })
      const live = await seedApiKey(t.prisma.db, m.id, { mode: 'live' })
      const res = await t.inject({
        method: 'POST',
        url: `/v1/api-keys/${live.id}/rotate`,
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
      })
      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('live_mode_unavailable')
      const row = await t.prisma.db.merchantApiKey.findUniqueOrThrow({ where: { id: live.id } })
      expect(row.revokedAt).toBeNull()
    })
  })

  it('rejects rotating a live key for a merchant that is no longer eligible', async () => {
    t.chain.environment = 'mainnet'
    const m = await seedMerchant(t.prisma.db, {
      onboardingCompleted: true,
      twoFactorEnabled: false,
    })
    const live = await seedApiKey(t.prisma.db, m.id, { mode: 'live' })
    const res = await t.inject({
      method: 'POST',
      url: `/v1/api-keys/${live.id}/rotate`,
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(res.statusCode).toBe(403)
    const body = JSON.parse(res.body)
    expect(body.error.code).toBe('live_mode_ineligible')
    expect(body.error.details.reasons.map((r: { code: string }) => r.code)).toEqual([
      'mfa_required',
    ])
    const row = await t.prisma.db.merchantApiKey.findUniqueOrThrow({ where: { id: live.id } })
    expect(row.revokedAt).toBeNull()
  })

  describe('full-access backfill migration', () => {
    it('adds the four new scopes only to unrevoked keys holding every earlier scope', async () => {
      const m = await seedMerchant(t.prisma.db)
      const full = await seedApiKey(t.prisma.db, m.id, { scopes: preEnforcementScopes })
      const narrow = await seedApiKey(t.prisma.db, m.id, { scopes: ['sessions_read'] })
      const revoked = await seedApiKey(t.prisma.db, m.id, {
        scopes: preEnforcementScopes,
        revoked: true,
      })

      await t.prisma.db.$executeRawUnsafe(backfillSql)

      const scopesOf = async (id: string) =>
        (await t.prisma.db.merchantApiKey.findUniqueOrThrow({ where: { id } })).scopes
      expect(preEnforcementScopes).toHaveLength(19)
      expect([...(await scopesOf(full.id))].sort()).toEqual([...allScopes].sort())
      expect(await scopesOf(full.id)).toHaveLength(23)
      expect(await scopesOf(narrow.id)).toEqual(['sessions_read'])
      expect(await scopesOf(revoked.id)).toEqual(preEnforcementScopes)
    })
  })
})
