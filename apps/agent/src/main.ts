import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Logger } from '@nestjs/common'
import helmet from '@fastify/helmet'

import { AppModule } from './app.module.js'
import { TypedConfigService } from './config/index.js'

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({ logger: false, trustProxy: true })
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  })
  const cfg = app.get(TypedConfigService)

  await app.register(helmet, { contentSecurityPolicy: false })
  app.enableShutdownHooks()
  await app.listen({ port: cfg.env.PORT, host: '0.0.0.0' })
  new Logger('Bootstrap').log(`Strimz agent listening on ${cfg.env.PORT} (${cfg.env.NODE_ENV})`)
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Strimz agent failed to start:', err)
  process.exit(1)
})
