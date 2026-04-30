import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'

import { HealthModule } from '../src/modules/health/health.module.js'

/**
 * Smoke test — boots a minimal Nest+Fastify app with just the Health module
 * and asserts /health is reachable. Full e2e tests require the database +
 * Redis stack and live in CI.
 */
describe('API smoke', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] }).compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    if (res.statusCode !== 200) {
      // eslint-disable-next-line no-console
      console.error('health failure body:', res.body)
    }
    expect(res.statusCode).toBe(200)
  })
})
