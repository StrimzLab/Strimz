import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { AdminRole } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'

const tokenFor = (email: string) => `test|${makePrivyDid(email)}|${email}|`
const TX = `0x${'ab'.repeat(32)}`
const HOUR = 3_600_000

interface Row {
  id: string
  category: string
  action: string
  onchain: boolean
  ipAddress: string | null
  metadata: Record<string, unknown>
  alert: { alertedAt: string | null } | null
}
interface Page {
  data: Row[]
  nextCursor: string | null
  hasMore: boolean
}

// ADR-2026-11-13-admin-audit-log (#260).
describe('GET /v1/admin/audit-log', () => {
  let t: TestApp
  let remote = 0

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
  })

  const admin = (email: string, role: AdminRole) =>
    t.prisma.db.adminUser.create({ data: { email, role, privyUserId: makePrivyDid(email) } })

  const get = (email: string, query = '') =>
    t.inject({
      method: 'GET',
      url: `/v1/admin/audit-log${query}`,
      remoteAddress: `198.51.100.${++remote % 250}`,
      headers: { authorization: `Bearer ${tokenFor(email)}` },
    })

  async function seed() {
    const m = await seedMerchant(t.prisma.db)
    const paused = await t.prisma.db.auditLog.create({
      data: {
        id: `onchain:5042002:${TX}:3`,
        category: 'admin',
        action: 'contract.paused',
        targetType: 'Contract',
        targetId: '0x00000000000000000000000000000000000000aa',
        metadata: {
          transactionHash: TX,
          logIndex: 3,
          blockNumber: 7,
          contractName: 'StrimzPayments',
        },
        createdAt: new Date(Date.now() - 3 * HOUR),
      },
    })
    await t.prisma.db.contractAlert.create({
      data: { auditLogId: paused.id, chainId: 5042002, alertedAt: new Date(Date.now() - 2 * HOUR) },
    })
    const payout = await t.prisma.db.auditLog.create({
      data: {
        id: `onchain:5042002:${TX}:4`,
        merchantId: m.id,
        category: 'merchant',
        action: 'merchant.payout_change_initiated_onchain',
        targetType: 'Merchant',
        targetId: m.id,
        metadata: { transactionHash: TX, logIndex: 4, blockNumber: 7 },
        createdAt: new Date(Date.now() - 2 * HOUR),
      },
    })
    await t.prisma.db.contractAlert.create({ data: { auditLogId: payout.id, chainId: 5042002 } })
    const invited = await t.prisma.db.auditLog.create({
      data: {
        category: 'admin',
        action: 'admin.invited',
        targetType: 'AdminUser',
        targetId: 'adm_1',
        actorEmail: 'owner@strimz.test',
        ipAddress: '203.0.113.9',
        createdAt: new Date(Date.now() - HOUR),
      },
    })
    return { m, paused, payout, invited }
  }

  it('lists everything newest first, with on-chain flags and alert state', async () => {
    await admin('owner@strimz.test', 'super_admin')
    const { paused, payout, invited } = await seed()

    const res = await get('owner@strimz.test')

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as Page
    expect(body.data.map((r) => r.id)).toEqual([invited.id, payout.id, paused.id])
    expect(body.data[0]).toMatchObject({ onchain: false, ipAddress: '203.0.113.9', alert: null })
    expect(body.data[1]).toMatchObject({ onchain: true, alert: { alertedAt: null } })
    expect(body.data[2]?.alert?.alertedAt).toEqual(expect.any(String))
    expect(body.data[2]?.metadata).toMatchObject({
      transactionHash: TX,
      contractName: 'StrimzPayments',
    })
  })

  it('lets admins in and keeps read-only admins out', async () => {
    await admin('ops@strimz.test', 'admin')
    await admin('viewer@strimz.test', 'read_only')

    expect((await get('ops@strimz.test')).statusCode).toBe(200)
    expect((await get('viewer@strimz.test')).statusCode).toBe(403)
  })

  it('filters by category, action, source, merchant and date', async () => {
    await admin('owner@strimz.test', 'super_admin')
    const { m, paused, payout, invited } = await seed()
    const ids = async (q: string) =>
      (JSON.parse((await get('owner@strimz.test', q)).body) as Page).data.map((r) => r.id)

    expect(await ids('?category=merchant')).toEqual([payout.id])
    expect(await ids('?category=admin,merchant')).toHaveLength(3)
    expect(await ids('?action=contract.paused')).toEqual([paused.id])
    expect(await ids('?onchain=true')).toEqual([payout.id, paused.id])
    expect(await ids('?onchain=false')).toEqual([invited.id])
    expect(await ids(`?merchantId=${m.id}`)).toEqual([payout.id])
    const from = new Date(Date.now() - 90 * 60_000).toISOString()
    expect(await ids(`?from=${encodeURIComponent(from)}`)).toEqual([invited.id])
  })

  it('pages with a cursor', async () => {
    await admin('owner@strimz.test', 'super_admin')
    const { paused, payout, invited } = await seed()

    const first = JSON.parse((await get('owner@strimz.test', '?limit=2')).body) as Page
    expect(first.data.map((r) => r.id)).toEqual([invited.id, payout.id])
    expect(first.hasMore).toBe(true)

    const second = JSON.parse(
      (
        await get(
          'owner@strimz.test',
          `?limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
        )
      ).body,
    ) as Page
    expect(second.data.map((r) => r.id)).toEqual([paused.id])
    expect(second.hasMore).toBe(false)
  })

  it('rejects an unknown category', async () => {
    await admin('owner@strimz.test', 'super_admin')
    expect((await get('owner@strimz.test', '?category=nope')).statusCode).toBe(400)
  })
})
