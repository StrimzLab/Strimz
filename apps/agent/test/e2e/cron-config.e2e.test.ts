import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { SchedulerRegistry } from '@nestjs/schedule'
import { AppModule } from '../../src/app.module.js'
import { TypedConfigService } from '../../src/config/index.js'
import { validateEnv } from '../../src/config/env.schema.js'
import { EmailService } from '../../src/infra/email/email.service.js'
import { StubEmailService } from '../helpers/stubs/email.stub.js'

const configured = {
  RECOVERY_TICK_CRON: '0 1 0 1 2 *',
  CASHFLOW_DIGEST_CRON: '0 2 0 1 2 *',
  CASHFLOW_ANOMALY_CRON: '0 3 0 1 2 *',
  CASHFLOW_YIELD_CRON: '0 4 0 1 2 *',
  COMMERCE_MONTHLY_CRON: '0 5 0 1 2 *',
  PRICING_MONTHLY_CRON: '0 6 0 1 2 *',
}

describe('cron schedules', () => {
  let app: NestFastifyApplication
  beforeAll(async () => {
    const env = { ...validateEnv({ ...process.env }), ...configured }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue(new StubEmailService())
      .overrideProvider(TypedConfigService)
      .useValue({ env })
      .compile()
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
    await app.init()
  })
  afterAll(async () => {
    await app.close()
  })

  it.each([
    ['recovery-tick', configured.RECOVERY_TICK_CRON],
    ['cashflow-digest', configured.CASHFLOW_DIGEST_CRON],
    ['cashflow-anomaly', configured.CASHFLOW_ANOMALY_CRON],
    ['cashflow-yield', configured.CASHFLOW_YIELD_CRON],
    ['commerce-monthly', configured.COMMERCE_MONTHLY_CRON],
    ['pricing-monthly', configured.PRICING_MONTHLY_CRON],
  ])('schedules %s from the validated config', (name, expected) => {
    const job = app.get(SchedulerRegistry).getCronJob(name)
    expect(job.cronTime.source).toBe(expected)
  })
})
