import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Redis } from 'ioredis'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'

describe('health e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })

  const readyz = () => t.app.inject({ method: 'GET', url: '/readyz' })

  it('reports ready when the database and Redis answer', async () => {
    const res = await readyz()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ready', checks: { database: 'ok', redis: 'ok' } })
  })

  it('reports unavailable when the database query fails', async () => {
    vi.spyOn(t.prisma.db, '$queryRawUnsafe').mockRejectedValueOnce(new Error('connection refused'))
    const res = await readyz()
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({
      status: 'unavailable',
      checks: { database: 'error', redis: 'ok' },
    })
  })

  it('reports unavailable when Redis does not answer', async () => {
    vi.spyOn(Redis.prototype, 'ping').mockReturnValueOnce(new Promise<'PONG'>(() => undefined))
    const res = await readyz()
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({
      status: 'unavailable',
      checks: { database: 'ok', redis: 'error' },
    })
  })

  it('keeps liveness independent of dependencies', async () => {
    vi.spyOn(t.prisma.db, '$queryRawUnsafe').mockRejectedValueOnce(new Error('connection refused'))
    const res = await t.app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
    expect((await readyz()).statusCode).toBe(503)
  })
})
