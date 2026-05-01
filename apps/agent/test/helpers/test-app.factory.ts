import { Test } from '@nestjs/testing'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../../src/app.module.js'
import { EmailService } from '../../src/infra/email/email.service.js'
import { PrismaService } from '../../src/infra/prisma/prisma.service.js'
import { StubEmailService } from './stubs/email.stub.js'

export interface TestApp {
  app: NestFastifyApplication
  prisma: PrismaService
  email: StubEmailService
  close: () => Promise<void>
}

export async function createTestApp(): Promise<TestApp> {
  const stubEmail = new StubEmailService()

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmailService)
    .useValue(stubEmail)
    .compile()

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  return {
    app,
    prisma: app.get(PrismaService),
    email: stubEmail,
    close: async () => {
      await app.close()
    },
  }
}
