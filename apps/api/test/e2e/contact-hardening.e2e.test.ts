import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'

describe('contact hardening e2e', () => {
  let t: TestApp
  let ipCounter = 0
  let remoteAddress = '198.51.102.0'

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.email.reset()
    ipCounter += 1
    remoteAddress = `198.51.102.${ipCounter}`
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const contact = (over: Record<string, unknown> = {}) =>
    t.inject({
      method: 'POST',
      url: '/v1/contact',
      payload: {
        name: 'Ada Lovelace',
        email: 'ada@example.test',
        topic: 'sales',
        message: 'We would like to talk about volume pricing for our business.',
        turnstileToken: 'good-token',
        ...over,
      },
      remoteAddress,
    })

  describe('POST /v1/contact', () => {
    it('rejects a submission without a Turnstile token and sends nothing', async () => {
      const res = await contact({ turnstileToken: undefined })

      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('bot_check_failed')
      expect(t.email.sent).toHaveLength(0)
    })

    it('rejects a token Turnstile refuses and sends nothing', async () => {
      const res = await contact({ turnstileToken: 'bad-token' })

      expect(res.statusCode).toBe(403)
      expect(JSON.parse(res.body).error.code).toBe('bot_check_failed')
      expect(t.email.sent).toHaveLength(0)
    })

    it('verifies the token for the contact action from the client address', async () => {
      const verify = vi.spyOn(t.turnstile, 'verify')

      const res = await contact()

      expect(res.statusCode).toBe(201)
      expect(verify).toHaveBeenCalledWith('good-token', remoteAddress, 'contact')
    })

    it('delivers a verified submission to the support inbox', async () => {
      const res = await contact()

      expect(res.statusCode).toBe(201)
      expect(JSON.parse(res.body)).toEqual({ ok: true })
      expect(t.email.sent).toHaveLength(1)
    })

    it('answers 502 email_unavailable when the email provider fails', async () => {
      vi.spyOn(t.email, 'send').mockRejectedValueOnce(new Error('resend: 503 service unavailable'))

      const res = await contact()

      expect(res.statusCode).toBe(502)
      expect(JSON.parse(res.body).error.code).toBe('email_unavailable')
    })
  })
})
