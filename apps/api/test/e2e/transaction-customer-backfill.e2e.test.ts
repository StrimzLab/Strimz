import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedCustomer,
  seedMerchant,
  seedPaymentSession,
  seedSubscription,
  seedTransaction,
} from '../helpers/fixtures.js'

const backfillSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../packages/db/prisma/migrations/20261113130000_backfill_transaction_customer/migration.sql',
  ),
  'utf8',
)

// ADR-2026-11-13-transaction-customer-link: link transactions recorded before the fix.
describe('transaction customer backfill', () => {
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

  it('links one-off payments to the session customer and charges to the subscription customer', async () => {
    const m = await seedMerchant(t.prisma.db)
    const c = await seedCustomer(t.prisma.db, m.id)
    const session = await seedPaymentSession(t.prisma.db, m.id, {
      status: 'confirmed',
      customerId: c.id,
    })
    const paid = await seedTransaction(t.prisma.db, m.id, { sessionId: session.id })
    const sub = await seedSubscription(t.prisma.db, m.id)
    const charged = await seedTransaction(t.prisma.db, m.id, { subscriptionId: sub.id })
    const anonymousSession = await seedPaymentSession(t.prisma.db, m.id, { status: 'confirmed' })
    const anonymous = await seedTransaction(t.prisma.db, m.id, { sessionId: anonymousSession.id })
    const other = await seedCustomer(t.prisma.db, m.id)
    const linkedSession = await seedPaymentSession(t.prisma.db, m.id, {
      status: 'confirmed',
      customerId: c.id,
    })
    const alreadySet = await seedTransaction(t.prisma.db, m.id, {
      sessionId: linkedSession.id,
      customerId: other.id,
    })

    await t.prisma.db.$executeRawUnsafe(backfillSql)
    await t.prisma.db.$executeRawUnsafe(backfillSql)

    const customerOf = async (id: string) =>
      (await t.prisma.db.transaction.findUniqueOrThrow({ where: { id } })).customerId
    expect(await customerOf(paid.id)).toBe(c.id)
    expect(await customerOf(charged.id)).toBe(sub.customerId)
    expect(await customerOf(anonymous.id)).toBeNull()
    expect(await customerOf(alreadySet.id)).toBe(other.id)
  })
})
