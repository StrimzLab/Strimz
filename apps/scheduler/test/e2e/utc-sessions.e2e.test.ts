import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { InvoiceOverdueService } from '../../src/crons/invoice-overdue/invoice-overdue.service.js'

// #419: Prisma stores UTC in timestamp-without-time-zone columns, so raw SQL
// comparing them with NOW() is only right when the session runs in UTC.
describe('database sessions on a server not set to UTC', () => {
  let t: TestApp

  const setDatabaseTimeZone = async (zone: string) => {
    await t.prisma.db.$executeRawUnsafe(
      `DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), '${zone}'); END $$`,
    )
    // The setting applies to new connections only.
    await t.prisma.db.$disconnect()
  }

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    await setDatabaseTimeZone('Asia/Tokyo')
  })
  afterEach(() => setDatabaseTimeZone('UTC'))

  it('runs every connection in UTC', async () => {
    const rows = await t.prisma.db.$queryRawUnsafe<{ tz: string }[]>(
      `SELECT current_setting('TimeZone') AS tz`,
    )
    expect(rows[0]?.tz).toBe('UTC')
  })

  it('leaves an invoice due in an hour as sent', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const invoice = await t.prisma.db.invoice.create({
      data: {
        merchantId: merchant.id,
        number: '2026-0101',
        lineItems: [{ description: 'Service', quantity: 1, unitAmount: '100' }] as never,
        subtotal: '100',
        total: '100',
        currency: 'USDC',
        status: 'sent',
        mode: 'test',
        dueAt: new Date(Date.now() + 60 * 60_000),
      },
    })

    const result = await t.app.get(InvoiceOverdueService).sweepNow()

    expect(result.flipped).toBe(0)
    const row = await t.prisma.db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })
    expect(row.status).toBe('sent')
  })
})
