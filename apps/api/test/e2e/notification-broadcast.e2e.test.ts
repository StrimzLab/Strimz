import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'

describe('GET /v1/notifications/broadcasts/:id', () => {
  let t: TestApp
  let senderId: string

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    const admin = await t.prisma.db.adminUser.create({
      data: { email: 'ops@strimz.test', role: 'super_admin' },
    })
    senderId = admin.id
  })

  const broadcast = (body: string, merchantId: string | null = null) =>
    t.prisma.db.adminBroadcast.create({
      data: {
        senderId,
        title: 'Maintenance window',
        body,
        audience: merchantId ? 'merchant' : 'all',
        merchantId,
      },
    })

  const read = (token: string, id: string) =>
    t.inject({
      method: 'GET',
      url: `/v1/notifications/broadcasts/${id}`,
      headers: { authorization: `Bearer ${token}` },
    })

  it('returns a broadcast sent to everyone', async () => {
    const m = await seedMerchant(t.prisma.db)
    const b = await broadcast('<p>Back at <strong>noon</strong>.</p>')

    const res = await read(m.privyAccessToken, b.id)

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({
      id: b.id,
      title: 'Maintenance window',
      html: '<p>Back at <strong>noon</strong>.</p>',
      createdAt: b.createdAt.toISOString(),
    })
  })

  it("returns a merchant's own broadcast and hides another merchant's", async () => {
    const mine = await seedMerchant(t.prisma.db)
    const other = await seedMerchant(t.prisma.db)
    const b = await broadcast('<p>Just for you.</p>', mine.id)

    expect((await read(mine.privyAccessToken, b.id)).statusCode).toBe(200)
    const res = await read(other.privyAccessToken, b.id)
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body).error.code).toBe('not_found')
  })

  it('returns 404 for an unknown id', async () => {
    const m = await seedMerchant(t.prisma.db)
    expect((await read(m.privyAccessToken, 'brd_missing')).statusCode).toBe(404)
  })

  it('strips scripts, handlers and unsafe links but keeps formatting', async () => {
    const m = await seedMerchant(t.prisma.db)
    const b = await broadcast(
      [
        '<p style="color:red">Hi <em>there</em><script>alert(1)</script></p>',
        '<img src=x onerror=alert(1)>',
        '<p onclick="alert(1)">Click</p>',
        '<a href="javascript:alert(1)">bad</a>',
        '<a href="//evil.test">relative</a>',
        '<a href="https://strimz.finance/docs">docs</a>',
        '<iframe src="https://evil.test"></iframe>',
      ].join(''),
    )

    const { html } = JSON.parse((await read(m.privyAccessToken, b.id)).body) as { html: string }

    expect(html).not.toMatch(/script|onerror|onclick|javascript:|iframe|style=|<img|evil\.test/iu)
    expect(html).toContain('<em>there</em>')
    expect(html).toContain(
      '<a href="https://strimz.finance/docs" rel="noopener noreferrer" target="_blank">docs</a>',
    )
  })
})
