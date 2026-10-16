import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'
import { must } from '../helpers/must.js'
import { AdminBootstrapError, bootstrapSuperAdmin } from '../../src/cli/admin-bootstrap.js'

describe('admin bootstrap command', () => {
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

  const deps = () => ({ prisma: t.prisma.db, privy: t.privy })

  const expectBootstrapError = async (run: Promise<unknown>, code: string) => {
    const err = await run.then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(AdminBootstrapError)
    expect((err as AdminBootstrapError).code).toBe(code)
  }

  it('creates an active super_admin bound to the given Privy DID, who can then sign in', async () => {
    const email = 'first-operator@strimz.test'
    const did = makePrivyDid(email)

    const created = await bootstrapSuperAdmin(deps(), { privyUserId: did, name: 'First Operator' })

    expect(created).toMatchObject({
      privyUserId: did,
      email,
      role: 'super_admin',
      status: 'active',
    })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/admin/me',
      headers: { authorization: `Bearer test|${did}|${email}|` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).role).toBe('super_admin')
  })

  it('records the bootstrap in the admin audit trail', async () => {
    const email = 'audited-operator@strimz.test'
    const created = await bootstrapSuperAdmin(deps(), { privyUserId: makePrivyDid(email) })

    const audit = await t.prisma.db.auditLog.findMany({
      where: { category: 'admin', action: 'admin.bootstrapped' },
    })
    expect(audit).toHaveLength(1)
    expect(must(audit[0])).toMatchObject({ targetType: 'AdminUser', targetId: created.id })
  })

  it('refuses when an active super_admin already exists', async () => {
    const existing = 'existing@strimz.test'
    await t.prisma.db.adminUser.create({
      data: { email: existing, role: 'super_admin', privyUserId: makePrivyDid(existing) },
    })
    const email = 'second@strimz.test'

    await expectBootstrapError(
      bootstrapSuperAdmin(deps(), { privyUserId: makePrivyDid(email) }),
      'super_admin_exists',
    )
    expect(await t.prisma.db.adminUser.count()).toBe(1)
  })

  it('refuses a value that is not a Privy DID', async () => {
    await expectBootstrapError(
      bootstrapSuperAdmin(deps(), { privyUserId: 'someone@strimz.test' }),
      'invalid_privy_did',
    )
    expect(await t.prisma.db.adminUser.count()).toBe(0)
  })

  it('refuses a Privy user with no email on record', async () => {
    await expectBootstrapError(
      bootstrapSuperAdmin(deps(), { privyUserId: 'did:privy:wallet-only-user' }),
      'privy_user_has_no_email',
    )
    expect(await t.prisma.db.adminUser.count()).toBe(0)
  })

  it('refuses when an admin row already holds the Privy user email', async () => {
    const email = 'pending-invitee@strimz.test'
    await t.prisma.db.adminUser.create({ data: { email, role: 'read_only' } })

    await expectBootstrapError(
      bootstrapSuperAdmin(deps(), { privyUserId: makePrivyDid(email) }),
      'admin_already_exists',
    )
    expect(await t.prisma.db.adminUser.count()).toBe(1)
  })

  it('is not blocked by a suspended super_admin', async () => {
    const suspended = 'suspended-owner@strimz.test'
    await t.prisma.db.adminUser.create({
      data: {
        email: suspended,
        role: 'super_admin',
        status: 'suspended',
        privyUserId: makePrivyDid(suspended),
      },
    })
    const email = 'replacement-owner@strimz.test'

    const created = await bootstrapSuperAdmin(deps(), { privyUserId: makePrivyDid(email) })

    expect(created).toMatchObject({ email, role: 'super_admin', status: 'active' })
  })

  it('fails with privy_lookup_failed when Privy cannot return the user, and writes nothing', async () => {
    const privy = {
      getUser: () => Promise.reject(new Error('privy unavailable')),
      primaryEmail: t.privy.primaryEmail.bind(t.privy),
    }

    await expectBootstrapError(
      bootstrapSuperAdmin(
        { prisma: t.prisma.db, privy },
        { privyUserId: makePrivyDid('unreachable@strimz.test') },
      ),
      'privy_lookup_failed',
    )
    expect(await t.prisma.db.adminUser.count()).toBe(0)
    expect(await t.prisma.db.auditLog.count()).toBe(0)
  })
})
