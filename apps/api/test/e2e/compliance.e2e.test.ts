import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'

describe('compliance e2e', () => {
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

  it('GET /v1/compliance/logs returns merchant-scoped log entries', async () => {
    const m = await seedMerchant(t.prisma.db)
    await t.prisma.db.complianceLog.createMany({
      data: [
        {
          walletAddress: '0x' + 'a'.repeat(40),
          provider: 'disabled',
          status: 'clear',
          flags: [],
          context: 'payer_checkout',
          merchantId: m.id,
        },
        {
          walletAddress: '0x' + 'b'.repeat(40),
          provider: 'disabled',
          status: 'flagged',
          flags: ['mixer'],
          context: 'subscriber_signup',
          merchantId: m.id,
        },
      ],
    })

    const res = await t.inject({
      method: 'GET',
      url: '/v1/compliance/logs',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toHaveLength(2)

    const filtered = await t.inject({
      method: 'GET',
      url: '/v1/compliance/logs?status=flagged',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(JSON.parse(filtered.body).data).toHaveLength(1)
    expect(JSON.parse(filtered.body).data[0].status).toBe('flagged')
  })
})
