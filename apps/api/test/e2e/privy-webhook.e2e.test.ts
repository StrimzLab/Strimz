import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'
import { must } from '../helpers/must.js'

const SECRET = Buffer.from('privy-webhook-test-secret')

// Privy's documented shape: `user` and `account` sit at the top level.
function signed(body: Record<string, unknown>, secret: Uint8Array = SECRET) {
  const raw = JSON.stringify(body)
  const id = `msg_${Math.random().toString(36).slice(2)}`
  const timestamp = String(Math.floor(Date.now() / 1000))
  const sig = createHmac('sha256', secret).update(`${id}.${timestamp}.${raw}`).digest('base64')
  return {
    payload: raw,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${sig}`,
    },
  }
}

describe('privy webhook e2e', () => {
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

  const deliver = (body: Record<string, unknown>, secret?: Uint8Array) =>
    t.inject({ method: 'POST', url: '/v1/auth/privy-webhook', ...signed(body, secret) })

  async function merchant(email: string) {
    const did = makePrivyDid(email)
    const res = await t.inject({
      method: 'POST',
      url: '/v1/auth/sync',
      payload: { accessToken: `test|${did}|${email}|`, turnstileToken: 'good-token' },
    })
    expect(res.statusCode).toBe(200)
    return {
      did,
      row: await t.prisma.db.merchant.findUniqueOrThrow({ where: { privyUserId: did } }),
    }
  }

  it('refreshes a known merchant from a real Privy payload', async () => {
    const { did } = await merchant('known@x.test')
    await t.prisma.db.merchant.update({
      where: { privyUserId: did },
      data: { lastLoginAt: new Date(0) },
    })

    const res = await deliver({
      type: 'user.authenticated',
      event_id: 'evt_1',
      user: { id: did, linked_accounts: [] },
      account: { type: 'email', address: 'known@x.test' },
    })

    expect(res.statusCode).toBe(200)
    const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { privyUserId: did } })
    expect(must(row.lastLoginAt).getTime()).toBeGreaterThan(0)
  })

  it('creates nothing for a Privy user with no Strimz account', async () => {
    const res = await deliver({
      type: 'user.authenticated',
      user: { id: makePrivyDid('stranger@x.test') },
      account: { type: 'email', address: 'stranger@x.test' },
    })

    expect(res.statusCode).toBe(200)
    expect(await t.prisma.db.merchant.count()).toBe(0)
  })

  it.each([
    ['user.linked_account', 'passkey.added'],
    ['user.unlinked_account', 'passkey.removed'],
  ])('records %s of a passkey in the audit log', async (type, action) => {
    const { did, row } = await merchant('keys@x.test')

    await deliver({
      type,
      user: { id: did },
      account: { type: 'passkey', credential_id: 'cred-1', created_with_browser: 'Chrome' },
    })

    const log = await t.prisma.db.auditLog.findFirstOrThrow({ where: { action } })
    expect(log).toMatchObject({ merchantId: row.id, category: 'auth', targetType: 'Merchant' })
  })

  it('refuses a payload with a bad signature', async () => {
    const res = await deliver(
      { type: 'user.authenticated', user: { id: 'x' } },
      Buffer.from('nope'),
    )
    expect(res.statusCode).toBe(401)
  })
})
