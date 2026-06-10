import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Logger } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { patchNestJsSwagger } from 'nestjs-zod'

import { AppModule } from './app.module.js'
import { TypedConfigService } from './config/index.js'

// Patches `@nestjs/swagger` so it understands DTOs created via
// `createZodDto(...)`. Must be called before SwaggerModule.createDocument.
patchNestJsSwagger()

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({ logger: false, trustProxy: true })
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  })
  const cfg = app.get(TypedConfigService)

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' })

  app.enableCors({
    origin: cfg.env.CORS_ORIGIN === '*' ? true : cfg.env.CORS_ORIGIN.split(','),
    credentials: true,
  })

  // OpenAPI spec — used by both /openapi.json and the Scalar UI at /docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Strimz API')
    .setDescription('B2B subscription billing infrastructure for stablecoin commerce on Arc.')
    .setVersion('2026-04-27')
    .setContact('Strimz', 'https://strimz.io', 'developers@strimz.io')
    .addServer(cfg.env.API_BASE_URL)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'privy')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'API key' }, 'apiKey')
    .build()
  const doc = SwaggerModule.createDocument(app, swaggerConfig)
  // Expose only the JSON spec; Scalar (mounted just below at /docs) is the
  // interactive UI. SwaggerModule.setup ships a Swagger-UI HTML page that
  // needs @fastify/static for its assets and would duplicate Scalar.
  app
    .getHttpAdapter()
    .getInstance()
    .get('/openapi.json', (_req, reply) => {
      void reply.send(doc)
    })

  // Scalar — beautiful interactive API reference at /docs.
  app.use(
    '/docs',
    apiReference({
      content: doc,
      theme: 'purple',
    }),
  )

  app.enableShutdownHooks()
  await app.listen({ port: cfg.env.PORT, host: '0.0.0.0' })
  new Logger('Bootstrap').log(
    `Strimz API listening on ${cfg.env.PORT} (${cfg.env.NODE_ENV}) — docs at /docs`,
  )
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Strimz API failed to start:', err)
  process.exit(1)
})
