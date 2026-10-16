import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'

describe('signup bot check e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })

  describe('POST /v1/auth/turnstile/verify', () => {
    it('is removed once Privy runs the bot check on login', async () => {
      const res = await t.inject({
        method: 'POST',
        url: '/v1/auth/turnstile/verify',
        payload: { token: 'good-token' },
        remoteAddress: '198.51.103.1',
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
