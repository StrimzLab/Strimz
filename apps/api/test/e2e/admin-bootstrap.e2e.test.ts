import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createPrismaClient, type PrismaClient } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'
import { must } from '../helpers/must.js'

const SEEDED_ADMIN_ID = 'adm_bootstrap_emmanuel'
const ADMIN_USERS_MIGRATION = '20260609122047_admin_users'

const dbPackageDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../packages/db')
const prismaBin = join(dbPackageDir, 'node_modules/.bin/prisma')
const migrationsDir = join(dbPackageDir, 'prisma/migrations')
const schemaDir = join(dbPackageDir, 'prisma/schema')

const tokenFor = (did: string, email: string) => `test|${did}|${email}|`

describe('admin bootstrap: sign-in never claims an admin row by email', () => {
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

  const getMe = (token: string) =>
    t.inject({
      method: 'GET',
      url: '/v1/admin/me',
      headers: { authorization: `Bearer ${token}` },
    })

  it('denies a Privy user whose only link to the seeded super_admin row is a matching email', async () => {
    const email = 'seeded-operator@strimz.test'
    await t.prisma.db.adminUser.create({
      data: { id: SEEDED_ADMIN_ID, email, name: 'Seeded', role: 'super_admin' },
    })
    const did = makePrivyDid(email)

    const res = await getMe(tokenFor(did, email))

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('admin_access_denied')
    const row = must(await t.prisma.db.adminUser.findUnique({ where: { id: SEEDED_ADMIN_ID } }))
    expect(row.privyUserId).toBeNull()
  })

  it('denies a Privy user whose only link to an invited admin row is a matching email', async () => {
    const inviterEmail = 'inviter@strimz.test'
    const inviter = await t.prisma.db.adminUser.create({
      data: {
        email: inviterEmail,
        role: 'super_admin',
        privyUserId: makePrivyDid(inviterEmail),
      },
    })
    const inviteeEmail = 'invitee@strimz.test'
    const invitee = await t.prisma.db.adminUser.create({
      data: { email: inviteeEmail, role: 'admin', invitedById: inviter.id },
    })

    const res = await getMe(tokenFor(makePrivyDid(inviteeEmail), inviteeEmail))

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('admin_access_denied')
    const row = must(await t.prisma.db.adminUser.findUnique({ where: { id: invitee.id } }))
    expect(row.privyUserId).toBeNull()
  })

  it('still admits an admin already bound to the caller Privy DID', async () => {
    const email = 'bound@strimz.test'
    const did = makePrivyDid(email)
    await t.prisma.db.adminUser.create({
      data: { email, role: 'super_admin', privyUserId: did },
    })

    const res = await getMe(tokenFor(did, email))

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).role).toBe('super_admin')
  })

  it('does not admit a Privy DID bound to nothing even when its email matches a bound admin', async () => {
    const email = 'bound-elsewhere@strimz.test'
    await t.prisma.db.adminUser.create({
      data: { email, role: 'super_admin', privyUserId: 'did:privy:the-real-operator' },
    })

    const res = await getMe(tokenFor(makePrivyDid(email), email))

    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('admin_access_denied')
  })
})

describe('admin bootstrap: migrations', () => {
  let admin: PrismaClient
  const scratchDatabases: string[] = []
  const scratchDirs: string[] = []

  const urlFor = (database: string) => {
    const url = new URL(must(process.env.DATABASE_URL, 'DATABASE_URL'))
    url.pathname = `/${database}`
    return url.toString()
  }

  const createScratchDatabase = async () => {
    const name = `strimz_admin_bootstrap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`)
    scratchDatabases.push(name)
    return urlFor(name)
  }

  const migrateDeploy = (databaseUrl: string, configPath?: string) => {
    const args = ['migrate', 'deploy']
    if (configPath) args.push('--config', configPath)
    execFileSync(prismaBin, args, {
      cwd: dbPackageDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    })
  }

  const migrateDeployThrough = (databaseUrl: string, lastMigration: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'strimz-migrations-'))
    scratchDirs.push(dir)
    const subset = join(dir, 'migrations')
    mkdirSync(subset)
    copyFileSync(join(migrationsDir, 'migration_lock.toml'), join(subset, 'migration_lock.toml'))
    const names = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name <= lastMigration)
      .map((e) => e.name)
      .sort()
    expect(names.at(-1)).toBe(lastMigration)
    for (const name of names) {
      mkdirSync(join(subset, name))
      copyFileSync(join(migrationsDir, name, 'migration.sql'), join(subset, name, 'migration.sql'))
    }
    const configPath = join(dir, 'prisma.config.mjs')
    writeFileSync(
      configPath,
      `export default ${JSON.stringify({
        schema: schemaDir,
        migrations: { path: subset },
        datasource: { url: databaseUrl },
      })}\n`,
    )
    migrateDeploy(databaseUrl, configPath)
  }

  const withClient = async <T>(databaseUrl: string, fn: (db: PrismaClient) => Promise<T>) => {
    const db = createPrismaClient({ databaseUrl })
    try {
      return await fn(db)
    } finally {
      await db.$disconnect()
    }
  }

  beforeAll(() => {
    admin = createPrismaClient({ databaseUrl: must(process.env.DATABASE_URL, 'DATABASE_URL') })
  })
  afterAll(async () => {
    for (const name of scratchDatabases) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
    }
    await admin.$disconnect()
    for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true })
  })

  it('leaves a freshly migrated database with no admin at all', async () => {
    const url = await createScratchDatabase()
    migrateDeploy(url)

    const rows = await withClient(url, (db) =>
      db.adminUser.findMany({ select: { id: true, role: true, privyUserId: true } }),
    )

    expect(rows).toEqual([])
  }, 180_000)

  it('removes the seeded super_admin on upgrade when nobody ever claimed it', async () => {
    const url = await createScratchDatabase()
    migrateDeployThrough(url, ADMIN_USERS_MIGRATION)
    const before = await withClient(
      url,
      (db) => db.$queryRaw<Array<{ privyUserId: string | null }>>`
        SELECT "privyUserId" FROM "AdminUser" WHERE "id" = ${SEEDED_ADMIN_ID}`,
    )
    expect(before).toEqual([{ privyUserId: null }])

    migrateDeploy(url)

    const after = await withClient(url, (db) =>
      db.adminUser.findUnique({ where: { id: SEEDED_ADMIN_ID } }),
    )
    expect(after).toBeNull()
  }, 180_000)

  it('keeps the seeded super_admin on upgrade when an operator already claimed it', async () => {
    const url = await createScratchDatabase()
    migrateDeployThrough(url, ADMIN_USERS_MIGRATION)
    const claimedBy = 'did:privy:operator-who-claimed'
    const claimed = await withClient(
      url,
      (db) => db.$executeRaw`
        UPDATE "AdminUser" SET "privyUserId" = ${claimedBy}, "lastLoginAt" = NOW()
        WHERE "id" = ${SEEDED_ADMIN_ID}`,
    )
    expect(claimed).toBe(1)

    migrateDeploy(url)

    const after = await withClient(url, (db) =>
      db.adminUser.findUnique({ where: { id: SEEDED_ADMIN_ID } }),
    )
    expect(after).toMatchObject({
      privyUserId: claimedBy,
      role: 'super_admin',
      status: 'active',
    })
  }, 180_000)
})
