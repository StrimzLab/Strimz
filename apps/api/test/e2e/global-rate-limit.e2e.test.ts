import { Logger } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { GLOBAL_RATE_LIMIT_PER_MINUTE } from '../../src/common/http/http-plugins.js'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'

describe('global rate limit', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp({ httpPlugins: { rateLimitMax: 2 } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('answers 429 rate_limited with a retry hint once the limit is spent', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error')
    for (let i = 0; i < 2; i++) {
      expect((await t.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
    }
    const res = await t.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(429)
    const body = JSON.parse(res.body)
    expect(body.error.code).toBe('rate_limited')
    expect(body.error.details.retryAfterSec).toBeGreaterThan(0)
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    expect(errorLog).not.toHaveBeenCalled()
    errorLog.mockRestore()
  })
})

describe('global rate limit defaults', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it(`allows ${GLOBAL_RATE_LIMIT_PER_MINUTE} requests a minute per address`, async () => {
    for (let i = 0; i < GLOBAL_RATE_LIMIT_PER_MINUTE; i++) {
      expect((await t.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
    }
    expect((await t.inject({ method: 'GET', url: '/health' })).statusCode).toBe(429)
  })
})
