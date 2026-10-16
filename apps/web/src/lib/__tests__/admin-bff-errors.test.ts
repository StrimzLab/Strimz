import { describe, expect, it } from 'vitest'

import { forwardAdminWrite } from '@/app/api/admin/_lib/forward'

describe('admin write forwarding errors', () => {
  it('answers a cross-origin write in the API error envelope', async () => {
    const req = new Request('https://strimz.finance/api/admin/merchants/mer_1/tier', {
      method: 'PATCH',
      headers: { origin: 'https://evil.test', authorization: 'Bearer privy-token' },
    })
    const res = await forwardAdminWrite(req, { method: 'PATCH', upstreamPath: '/v1/admin/x' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: { code: 'csrf_origin_mismatch', message: 'cross-origin admin write rejected' },
    })
  })

  it('answers a write without a bearer token in the API error envelope', async () => {
    const req = new Request('https://strimz.finance/api/admin/merchants/mer_1/tier', {
      method: 'PATCH',
    })
    const res = await forwardAdminWrite(req, { method: 'PATCH', upstreamPath: '/v1/admin/x' })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'authentication_error', message: 'missing bearer token' },
    })
  })
})
