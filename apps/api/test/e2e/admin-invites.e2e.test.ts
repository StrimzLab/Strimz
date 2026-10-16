import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'
import { must } from '../helpers/must.js'

const tokenFor = (email: string) => `test|${makePrivyDid(email)}|${email}|`
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

describe('admin invites: accepted with a one-time token', () => {
  let t: TestApp
  let testIndex = 0
  let remoteAddress = '198.51.100.0'

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.email.reset()
    testIndex += 1
    remoteAddress = `198.51.100.${testIndex}`
  })

  const createSuperAdmin = (email = 'owner@strimz.test') =>
    t.prisma.db.adminUser.create({
      data: { email, role: 'super_admin', privyUserId: makePrivyDid(email) },
    })

  const invite = async (inviterEmail: string, inviteeEmail: string, role = 'admin') => {
    const res = await t.inject({
      method: 'POST',
      url: '/v1/admin/admins',
      remoteAddress,
      headers: { authorization: `Bearer ${tokenFor(inviterEmail)}` },
      payload: { email: inviteeEmail, role },
    })
    expect(res.statusCode).toBe(201)
    return JSON.parse(res.body) as { id: string; email: string }
  }

  const lastInviteToken = (to: string) => {
    const mail = must(
      [...t.email.sent].reverse().find((m) => m.to === to),
      `invite email to ${to}`,
    )
    const match = mail.html.match(/\/admin\/accept-invite\?token=([A-Za-z0-9_-]+)/)
    return must(match?.[1], 'invite token in email')
  }

  const accept = (callerEmail: string, token: string) =>
    t.inject({
      method: 'POST',
      url: '/v1/admin/invites/accept',
      remoteAddress,
      headers: { authorization: `Bearer ${tokenFor(callerEmail)}` },
      payload: { token },
    })

  const resend = (inviterEmail: string, adminId: string) =>
    t.inject({
      method: 'POST',
      url: `/v1/admin/admins/${adminId}/invite`,
      remoteAddress,
      headers: { authorization: `Bearer ${tokenFor(inviterEmail)}` },
    })

  const getMe = (email: string) =>
    t.inject({
      method: 'GET',
      url: '/v1/admin/me',
      headers: { authorization: `Bearer ${tokenFor(email)}` },
    })

  it('stores only a hash of the token with a 7-day expiry and emails an accept link', async () => {
    await createSuperAdmin()
    const before = Date.now()
    const created = await invite('owner@strimz.test', 'invitee@strimz.test')

    const token = lastInviteToken('invitee@strimz.test')
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    const row = must(await t.prisma.db.adminUser.findUnique({ where: { id: created.id } }))
    expect(row.privyUserId).toBeNull()
    expect(row.inviteTokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(row.inviteTokenHash).not.toContain(token)
    const expiresAt = must(row.inviteExpiresAt).getTime()
    expect(expiresAt).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS)
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + SEVEN_DAYS_MS)
  })

  it('binds the caller DID when the token is valid and the verified email matches', async () => {
    await createSuperAdmin()
    const created = await invite('owner@strimz.test', 'invitee@strimz.test')
    const token = lastInviteToken('invitee@strimz.test')

    const res = await accept('invitee@strimz.test', token)

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({
      id: created.id,
      email: 'invitee@strimz.test',
      role: 'admin',
    })
    const row = must(await t.prisma.db.adminUser.findUnique({ where: { id: created.id } }))
    expect(row.privyUserId).toBe(makePrivyDid('invitee@strimz.test'))
    expect(row.inviteTokenHash).toBeNull()
    expect(row.inviteExpiresAt).toBeNull()
    const audit = await t.prisma.db.auditLog.findMany({
      where: { category: 'admin', action: 'admin.invite_accepted' },
    })
    expect(audit).toHaveLength(1)
    expect(must(audit[0])).toMatchObject({
      actorId: created.id,
      targetType: 'AdminUser',
      targetId: created.id,
    })
    expect((await getMe('invitee@strimz.test')).statusCode).toBe(200)
  })

  it('does not admit the invitee before the invite is accepted', async () => {
    await createSuperAdmin()
    await invite('owner@strimz.test', 'invitee@strimz.test')

    const res = await getMe('invitee@strimz.test')

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('admin_access_denied')
  })

  it('rejects an expired token', async () => {
    await createSuperAdmin()
    const created = await invite('owner@strimz.test', 'invitee@strimz.test')
    const token = lastInviteToken('invitee@strimz.test')
    await t.prisma.db.adminUser.update({
      where: { id: created.id },
      data: { inviteExpiresAt: new Date(Date.now() - 1000) },
    })

    const res = await accept('invitee@strimz.test', token)

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('invite_invalid')
    const row = must(await t.prisma.db.adminUser.findUnique({ where: { id: created.id } }))
    expect(row.privyUserId).toBeNull()
  })

  it('rejects a token that was already used', async () => {
    await createSuperAdmin()
    await invite('owner@strimz.test', 'invitee@strimz.test')
    const token = lastInviteToken('invitee@strimz.test')
    expect((await accept('invitee@strimz.test', token)).statusCode).toBe(200)

    const res = await accept('invitee@strimz.test', token)

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('invite_invalid')
  })

  it('rejects an unknown token', async () => {
    await createSuperAdmin()
    await invite('owner@strimz.test', 'invitee@strimz.test')

    const res = await accept('invitee@strimz.test', Buffer.alloc(32, 7).toString('base64url'))

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('invite_invalid')
  })

  it('rejects a valid token presented by a Privy user with a different email', async () => {
    await createSuperAdmin()
    const created = await invite('owner@strimz.test', 'invitee@strimz.test')
    const token = lastInviteToken('invitee@strimz.test')

    const res = await accept('someone-else@strimz.test', token)

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('invite_email_mismatch')
    const row = must(await t.prisma.db.adminUser.findUnique({ where: { id: created.id } }))
    expect(row.privyUserId).toBeNull()
    expect(row.inviteTokenHash).not.toBeNull()
  })

  it('rejects acceptance without a Privy session', async () => {
    await createSuperAdmin()
    await invite('owner@strimz.test', 'invitee@strimz.test')
    const token = lastInviteToken('invitee@strimz.test')

    const res = await t.inject({
      method: 'POST',
      url: '/v1/admin/invites/accept',
      remoteAddress,
      payload: { token },
    })

    expect(res.statusCode).toBe(401)
  })

  it('rejects an invite for an admin row that is suspended', async () => {
    await createSuperAdmin()
    const created = await invite('owner@strimz.test', 'invitee@strimz.test')
    const token = lastInviteToken('invitee@strimz.test')
    await t.prisma.db.adminUser.update({
      where: { id: created.id },
      data: { status: 'suspended' },
    })

    const res = await accept('invitee@strimz.test', token)

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('invite_invalid')
  })

  it('re-sending an invite issues a new token and invalidates the previous one', async () => {
    await createSuperAdmin()
    const created = await invite('owner@strimz.test', 'invitee@strimz.test')
    const first = lastInviteToken('invitee@strimz.test')

    const res = await resend('owner@strimz.test', created.id)

    expect(res.statusCode).toBe(201)
    const second = lastInviteToken('invitee@strimz.test')
    expect(second).not.toBe(first)
    const stale = await accept('invitee@strimz.test', first)
    expect(stale.statusCode).toBe(400)
    expect(JSON.parse(stale.body).error.code).toBe('invite_invalid')
    expect((await accept('invitee@strimz.test', second)).statusCode).toBe(200)
    const audit = await t.prisma.db.auditLog.findMany({
      where: { category: 'admin', action: 'admin.invite_resent' },
    })
    expect(audit).toHaveLength(1)
  })

  it('makes a pre-existing invite without a token acceptable once it is re-sent', async () => {
    const owner = await createSuperAdmin()
    const legacy = await t.prisma.db.adminUser.create({
      data: { email: 'legacy@strimz.test', role: 'read_only', invitedById: owner.id },
    })

    const res = await resend('owner@strimz.test', legacy.id)

    expect(res.statusCode).toBe(201)
    const token = lastInviteToken('legacy@strimz.test')
    expect((await accept('legacy@strimz.test', token)).statusCode).toBe(200)
  })

  it('refuses to re-send an invite that was already accepted', async () => {
    await createSuperAdmin()
    const created = await invite('owner@strimz.test', 'invitee@strimz.test')
    expect(
      (await accept('invitee@strimz.test', lastInviteToken('invitee@strimz.test'))).statusCode,
    ).toBe(200)

    const res = await resend('owner@strimz.test', created.id)

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('invalid_state')
  })

  it('only a super_admin can re-send an invite', async () => {
    const owner = await createSuperAdmin()
    await t.prisma.db.adminUser.create({
      data: {
        email: 'plain-admin@strimz.test',
        role: 'admin',
        privyUserId: makePrivyDid('plain-admin@strimz.test'),
      },
    })
    const pending = await t.prisma.db.adminUser.create({
      data: { email: 'pending@strimz.test', role: 'read_only', invitedById: owner.id },
    })

    const res = await resend('plain-admin@strimz.test', pending.id)

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('admin_insufficient_role')
  })

  it('lists pending invites as pending', async () => {
    await createSuperAdmin()
    const created = await invite('owner@strimz.test', 'invitee@strimz.test')

    const res = await t.inject({
      method: 'GET',
      url: '/v1/admin/admins',
      headers: { authorization: `Bearer ${tokenFor('owner@strimz.test')}` },
    })

    expect(res.statusCode).toBe(200)
    const rows = JSON.parse(res.body).data as Array<Record<string, unknown>>
    const row = must(rows.find((r) => r.id === created.id))
    expect(row.invitePending).toBe(true)
    expect(typeof row.inviteExpiresAt).toBe('string')
    expect(row).not.toHaveProperty('inviteTokenHash')
    expect(row).not.toHaveProperty('privyUserId')
    const owner = must(rows.find((r) => r.email === 'owner@strimz.test'))
    expect(owner.invitePending).toBe(false)
  })
})
