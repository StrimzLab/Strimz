import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'

import { AppModule } from '../../src/app.module.js'
import { PrivyService } from '../../src/infra/privy/privy.service.js'
import { TurnstileService } from '../../src/infra/turnstile/turnstile.service.js'
import { QueueService } from '../../src/infra/queue/queue.service.js'
import { EmailService } from '../../src/infra/email/email.service.js'
import { ChainService } from '../../src/infra/chain/chain.service.js'
import { RedisService } from '../../src/infra/redis/redis.service.js'
import { PrismaService } from '../../src/infra/prisma/prisma.service.js'

import { StubPrivyService } from './stubs/privy.stub.js'
import { StubTurnstileService } from './stubs/turnstile.stub.js'
import { StubQueueService } from './stubs/queue.stub.js'
import { StubEmailService } from './stubs/email.stub.js'
import { StubChainService } from './stubs/chain.stub.js'
import { StubRedisService } from './stubs/redis.stub.js'

export interface TestApp {
  app: NestFastifyApplication
  prisma: PrismaService
  privy: StubPrivyService
  turnstile: StubTurnstileService
  queue: StubQueueService
  email: StubEmailService
  /** Convenience: same Fastify request injector you'd get from supertest. */
  inject: NestFastifyApplication['inject']
  close: () => Promise<void>
}

/**
 * Boot a fully wired NestJS+Fastify application against the test database
 * with every external dependency replaced by a recording stub.
 *
 * Each test should:
 *
 *   const t = await createTestApp()
 *   try { ... } finally { await t.close() }
 *
 * or use the provided `withTestApp(fn)` helper to handle teardown.
 */
export async function createTestApp(): Promise<TestApp> {
  const stubPrivy = new StubPrivyService()
  const stubTurnstile = new StubTurnstileService()
  const stubQueue = new StubQueueService()
  const stubEmail = new StubEmailService()
  const stubChain = new StubChainService()
  const stubRedis = new StubRedisService()

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    providers: [{ provide: APP_PIPE, useClass: ZodValidationPipe }],
  })
    .overrideProvider(PrivyService)
    .useValue(stubPrivy)
    .overrideProvider(TurnstileService)
    .useValue(stubTurnstile)
    .overrideProvider(QueueService)
    .useValue(stubQueue)
    .overrideProvider(EmailService)
    .useValue(stubEmail)
    .overrideProvider(ChainService)
    .useValue(stubChain)
    .overrideProvider(RedisService)
    .useValue(stubRedis)
    .compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  const prisma = app.get(PrismaService)
  const inject = app.inject.bind(app) as NestFastifyApplication['inject']

  return {
    app,
    prisma,
    privy: stubPrivy,
    turnstile: stubTurnstile,
    queue: stubQueue,
    email: stubEmail,
    inject,
    close: async () => {
      await app.close()
    },
  }
}
