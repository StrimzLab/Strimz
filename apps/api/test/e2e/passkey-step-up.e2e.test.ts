import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'
import { stepUp } from '../helpers/step-up.js'

const KEY = { name: 'Server', kind: 'secret', mode: 'test', scopes: ['sessions_write'] }

describe('passkey step-up (ADR-2026-11-22-passkey-step-up)', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.redis.reset()
  })

  const merchant = (passkey = true) =>
    seedMerchant(t.prisma.db, { onboardingCompleted: true, passkey })
  const createKey = (token: string, stepUpToken?: string) =>
    t.inject({
      method: 'POST',
      url: '/v1/api-keys',
      headers: {
        authorization: `Bearer ${token}`,
        ...(stepUpToken ? { 'x-strimz-step-up': stepUpToken } : {}),
      },
      payload: KEY,
    })
  const code = (body: string) => (JSON.parse(body) as { error: { code: string } }).error.code

  it('refuses to create a key from the dashboard without a passkey confirmation', async () => {
    const m = await merchant()

    const res = await createKey(m.privyAccessToken)

    expect(res.statusCode).toBe(403)
    expect(code(res.body)).toBe('step_up_required')
    expect(await t.prisma.db.merchantApiKey.count()).toBe(0)
  })

  it('creates the key after a passkey confirmation, and the confirmation works once', async () => {
    const m = await merchant()
    const token = await stepUp(t, m.privyAccessToken, 'api_keys.create')

    expect((await createKey(m.privyAccessToken, token)).statusCode).toBe(201)
    const again = await createKey(m.privyAccessToken, token)

    expect(again.statusCode).toBe(403)
    expect(code(again.body)).toBe('step_up_required')
  })

  it('lets a merchant who just added a passkey create a key without signing in again', async () => {
    const m = await seedMerchant(t.prisma.db, {
      onboardingCompleted: true,
      emailVerified: true,
      twoFactorEnabled: false,
    })
    t.chain.environment = 'mainnet'
    try {
      const token = await stepUp(t, m.privyAccessToken, 'api_keys.create')
      const res = await t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${m.privyAccessToken}`, 'x-strimz-step-up': token },
        payload: { ...KEY, mode: 'live' },
      })
      expect(res.statusCode).toBe(201)
    } finally {
      t.chain.environment = 'testnet'
    }
  })

  it('asks for the challenge on the dashboard origin', async () => {
    const m = await merchant()
    await stepUp(t, m.privyAccessToken, 'api_keys.create')

    expect(t.privy.passkeyChallenges.at(-1)).toBe(process.env.STRIMZ_DASHBOARD_URL)
  })

  it('does not accept a confirmation made for another action', async () => {
    const m = await merchant()
    const token = await stepUp(t, m.privyAccessToken, 'webhook_endpoints.create')

    expect((await createKey(m.privyAccessToken, token)).statusCode).toBe(403)
  })

  it("does not accept another merchant's confirmation", async () => {
    const a = await merchant()
    const b = await merchant()
    const token = await stepUp(t, a.privyAccessToken, 'api_keys.create')

    expect((await createKey(b.privyAccessToken, token)).statusCode).toBe(403)
  })

  it('refuses a failed passkey', async () => {
    const m = await merchant()

    await expect(stepUp(t, m.privyAccessToken, 'api_keys.create', 'forged')).rejects.toThrow(
      /401|403/,
    )
  })

  it('asks a merchant without a passkey to add one', async () => {
    const m = await merchant(false)

    const res = await t.inject({
      method: 'POST',
      url: '/v1/auth/step-up/start',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
      payload: { action: 'api_keys.create' },
    })

    expect(res.statusCode).toBe(403)
    expect(code(res.body)).toBe('passkey_required')
  })

  it('does not apply to a server calling with an API key', async () => {
    const m = await merchant()
    const key = await seedApiKey(t.prisma.db, m.id, { scopes: ['api_keys_write'] })

    const res = await t.inject({
      method: 'POST',
      url: '/v1/api-keys',
      headers: { authorization: `Bearer ${key.secretKey}` },
      payload: { name: 'Child', kind: 'secret', mode: 'test', scopes: ['api_keys_write'] },
    })

    expect(res.statusCode).toBe(201)
  })

  it('guards creating a webhook endpoint and rotating its secret', async () => {
    const m = await merchant()
    const auth = { authorization: `Bearer ${m.privyAccessToken}` }

    const blocked = await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: auth,
      payload: { url: 'https://example.com/hooks', events: ['payment.completed'], mode: 'test' },
    })
    expect(blocked.statusCode).toBe(403)

    const created = await t.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: {
        ...auth,
        'x-strimz-step-up': await stepUp(t, m.privyAccessToken, 'webhook_endpoints.create'),
      },
      payload: { url: 'https://example.com/hooks', events: ['payment.completed'], mode: 'test' },
    })
    expect(created.statusCode).toBe(201)
    const id = (JSON.parse(created.body) as { id: string }).id

    const rotateBlocked = await t.inject({
      method: 'POST',
      url: `/v1/webhook-endpoints/${id}/rotate-secret`,
      headers: auth,
    })
    expect(rotateBlocked.statusCode).toBe(403)
  })
})
