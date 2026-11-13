import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'
import { must } from '../helpers/must.js'

const ADMIN = 'ops@strimz.test'
const tokenFor = (email: string) => `test|${makePrivyDid(email)}|${email}|`

// #443: the email uses the same allowlist as the dashboard broadcast page.
describe('broadcast email HTML', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.email.reset()
    await t.prisma.db.adminUser.create({
      data: { email: ADMIN, role: 'super_admin', privyUserId: makePrivyDid(ADMIN) },
    })
  })

  it('strips handlers, scripts and unsafe links but keeps formatting', async () => {
    const m = await seedMerchant(t.prisma.db)

    const res = await t.inject({
      method: 'POST',
      url: '/v1/admin/broadcasts',
      headers: { authorization: `Bearer ${tokenFor(ADMIN)}` },
      payload: {
        title: 'Maintenance window',
        audience: 'all',
        body: [
          '<p>Back at <strong>noon</strong>.</p>',
          '<img src=x onerror=alert(1)>',
          '<a href="javascript:alert(1)">bad</a>',
          '<svg><script>alert(1)</script></svg>',
          '<a href="https://strimz.finance/status">status</a>',
        ].join(''),
      },
    })

    expect(res.statusCode).toBe(201)
    const mail = must(t.email.sent.find((s) => s.to === m.email))
    // The layout has its own logo <img>, so look for the injected one.
    expect(mail.html).not.toMatch(/onerror|javascript:|<script|<svg|src="?x\b/iu)
    expect(mail.html).toContain('<strong>noon</strong>')
    expect(mail.html).toContain('href="https://strimz.finance/status"')
  })
})
