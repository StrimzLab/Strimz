import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedCustomer, seedMerchant, seedTransaction } from '../helpers/fixtures.js'

const OCT_1 = '2026-10-01T00:00:00Z'
const NOV_1 = '2026-11-01T00:00:00Z'

describe('from / to on list routes', () => {
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

  function get(secretKey: string, path: string) {
    return t.inject({
      method: 'GET',
      url: path,
      headers: { authorization: `Bearer ${secretKey}` },
    })
  }

  const ids = (body: string) => (JSON.parse(body).data as Array<{ id: string }>).map((r) => r.id)
  const at = (iso: string) => new Date(iso)

  async function merchantWithKey(scopes: string[]) {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes })
    return { m, k }
  }

  describe('GET /v1/transactions', () => {
    it('returns only transactions settled in the range, newest first', async () => {
      const { m, k } = await merchantWithKey(['transactions_read'])
      await seedTransaction(t.prisma.db, m.id, { blockTimestamp: at('2026-09-30T23:59:59Z') })
      const early = await seedTransaction(t.prisma.db, m.id, {
        blockTimestamp: at('2026-10-02T10:00:00Z'),
      })
      const late = await seedTransaction(t.prisma.db, m.id, {
        blockTimestamp: at('2026-10-30T10:00:00Z'),
      })
      await seedTransaction(t.prisma.db, m.id, { blockTimestamp: at('2026-11-02T00:00:00Z') })

      const res = await get(k.secretKey, `/v1/transactions?from=${OCT_1}&to=${NOV_1}`)

      expect(res.statusCode).toBe(200)
      expect(ids(res.body)).toEqual([late.id, early.id])
    })

    it('includes a row exactly at from and excludes one exactly at to', async () => {
      const { m, k } = await merchantWithKey(['transactions_read'])
      const atFrom = await seedTransaction(t.prisma.db, m.id, { blockTimestamp: at(OCT_1) })
      await seedTransaction(t.prisma.db, m.id, { blockTimestamp: at(NOV_1) })

      const res = await get(k.secretKey, `/v1/transactions?from=${OCT_1}&to=${NOV_1}`)

      expect(ids(res.body)).toEqual([atFrom.id])
    })

    it('accepts only from, or only to', async () => {
      const { m, k } = await merchantWithKey(['transactions_read'])
      const before = await seedTransaction(t.prisma.db, m.id, {
        blockTimestamp: at('2026-09-15T00:00:00Z'),
      })
      const after = await seedTransaction(t.prisma.db, m.id, {
        blockTimestamp: at('2026-10-15T00:00:00Z'),
      })

      expect(ids((await get(k.secretKey, `/v1/transactions?from=${OCT_1}`)).body)).toEqual([
        after.id,
      ])
      expect(ids((await get(k.secretKey, `/v1/transactions?to=${OCT_1}`)).body)).toEqual([
        before.id,
      ])
    })

    it('reads an offset as the instant it names', async () => {
      const { m, k } = await merchantWithKey(['transactions_read'])
      const tx = await seedTransaction(t.prisma.db, m.id, {
        blockTimestamp: at('2026-09-30T23:30:00Z'),
      })

      const res = await get(
        k.secretKey,
        `/v1/transactions?from=${encodeURIComponent('2026-10-01T00:00:00+01:00')}`,
      )

      expect(ids(res.body)).toEqual([tx.id])
    })

    it('combines with other filters', async () => {
      const { m, k } = await merchantWithKey(['transactions_read'])
      const customer = await seedCustomer(t.prisma.db, m.id)
      const theirs = await seedTransaction(t.prisma.db, m.id, {
        customerId: customer.id,
        blockTimestamp: at('2026-10-10T00:00:00Z'),
      })
      await seedTransaction(t.prisma.db, m.id, { blockTimestamp: at('2026-10-10T00:00:00Z') })
      await seedTransaction(t.prisma.db, m.id, {
        customerId: customer.id,
        blockTimestamp: at('2026-12-10T00:00:00Z'),
      })

      const res = await get(
        k.secretKey,
        `/v1/transactions?from=${OCT_1}&to=${NOV_1}&customerId=${customer.id}`,
      )

      expect(ids(res.body)).toEqual([theirs.id])
    })

    it('pages through a range with the cursor', async () => {
      const { m, k } = await merchantWithKey(['transactions_read'])
      const rows = []
      for (let day = 3; day <= 7; day += 1) {
        rows.push(
          await seedTransaction(t.prisma.db, m.id, {
            blockTimestamp: at(`2026-10-0${day}T00:00:00Z`),
          }),
        )
      }
      await seedTransaction(t.prisma.db, m.id, { blockTimestamp: at('2026-11-05T00:00:00Z') })

      const seen: string[] = []
      let cursor: string | null = null
      do {
        const query = `from=${OCT_1}&to=${NOV_1}&limit=2${cursor ? `&cursor=${cursor}` : ''}`
        const page = JSON.parse((await get(k.secretKey, `/v1/transactions?${query}`)).body)
        seen.push(...page.data.map((r: { id: string }) => r.id))
        cursor = page.nextCursor
      } while (cursor)

      expect(seen).toEqual(rows.map((r) => r.id).reverse())
    })

    it("never returns another merchant's transactions", async () => {
      const { k } = await merchantWithKey(['transactions_read'])
      const other = await seedMerchant(t.prisma.db)
      await seedTransaction(t.prisma.db, other.id, { blockTimestamp: at('2026-10-10T00:00:00Z') })

      const res = await get(k.secretKey, `/v1/transactions?from=${OCT_1}&to=${NOV_1}`)

      expect(ids(res.body)).toEqual([])
    })

    it.each([
      ['from equal to to', `from=${OCT_1}&to=${OCT_1}`],
      ['from after to', `from=${NOV_1}&to=${OCT_1}`],
      ['a bare date', 'from=2026-10-01'],
      ['no offset', 'from=2026-10-01T00:00:00'],
      ['garbage', 'to=yesterday'],
    ])('refuses %s with 400', async (_label, query) => {
      const { k } = await merchantWithKey(['transactions_read'])

      const res = await get(k.secretKey, `/v1/transactions?${query}`)

      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error.code).toBe('invalid_request')
    })
  })

  describe('GET /v1/agents/activity', () => {
    function seedActivity(merchantId: string, createdAt: string) {
      return t.prisma.db.agentActivityLog.create({
        data: {
          merchantId,
          capability: 'recovery',
          actionType: 'recovery_notification_sent',
          outcome: 'success',
          createdAt: at(createdAt),
        },
      })
    }

    it('returns only activity recorded in the range', async () => {
      const { m, k } = await merchantWithKey(['agents_read'])
      await seedActivity(m.id, '2026-09-30T12:00:00Z')
      const inside = await seedActivity(m.id, '2026-10-15T12:00:00Z')
      await seedActivity(m.id, NOV_1)

      const res = await get(k.secretKey, `/v1/agents/activity?from=${OCT_1}&to=${NOV_1}`)

      expect(res.statusCode).toBe(200)
      expect(ids(res.body)).toEqual([inside.id])
    })

    it('refuses from after to with 400', async () => {
      const { k } = await merchantWithKey(['agents_read'])

      const res = await get(k.secretKey, `/v1/agents/activity?from=${NOV_1}&to=${OCT_1}`)

      expect(res.statusCode).toBe(400)
    })
  })

  it('still refuses from on a list route that has no date filter', async () => {
    const { k } = await merchantWithKey(['refunds_read'])

    const res = await get(k.secretKey, `/v1/refunds?from=${OCT_1}`)

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('invalid_request')
  })
})
