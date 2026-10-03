import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../../src/app.module.js'
import { ChainService } from '../../src/infra/chain/chain.service.js'
import { EmailService } from '../../src/infra/email/email.service.js'
import { PrismaService } from '../../src/infra/prisma/prisma.service.js'
import { WebhookTargetPolicy } from '../../src/infra/webhook-transport/webhook-target-policy.js'
import { StubChainService } from './stubs/chain.stub.js'
import { StubEmailService } from './stubs/email.stub.js'
import { StubWebhookTargetPolicy } from './stubs/webhook-target-policy.stub.js'

export interface TestApp {
  app: NestFastifyApplication
  prisma: PrismaService
  chain: StubChainService
  email: StubEmailService
  webhookTargets: StubWebhookTargetPolicy
  close: () => Promise<void>
}

/**
 * Boots the full scheduler app against the test Postgres + Redis from
 * globalSetup. The chain client and email service are stubbed so workers
 * can run without hitting a real RPC node or sending mail.
 */
export async function createTestApp(): Promise<TestApp> {
  const stubChain = new StubChainService()
  const stubEmail = new StubEmailService()
  const stubWebhookTargets = new StubWebhookTargetPolicy()

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ChainService)
    .useValue(stubChain)
    .overrideProvider(EmailService)
    .useValue(stubEmail)
    .overrideProvider(WebhookTargetPolicy)
    .useValue(stubWebhookTargets)
    .compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  return {
    app,
    prisma: app.get(PrismaService),
    chain: stubChain,
    email: stubEmail,
    webhookTargets: stubWebhookTargets,
    close: async () => {
      await app.close()
    },
  }
}
