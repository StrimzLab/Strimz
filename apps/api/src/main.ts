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
  // Svix / Privy webhook signature verification needs the exact bytes
  // Fastify received: re-serialising the parsed body loses ordering
  // and whitespace, and the HMAC no longer matches. We register our
  // own JSON parser that stashes the raw string on `req.rawBody`, and
  // we tell Nest to skip its default JSON parser so it does not fight
  // us for the same content-type slot.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
    bodyParser: false,
  })
  adapter
    .getInstance()
    .addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      try {
        const parsed = body.length ? JSON.parse(body as string) : {}
        ;(req as unknown as { rawBody?: string }).rawBody = body as string
        done(null, parsed)
      } catch (err) {
        done(err as Error, undefined)
      }
    })
  const cfg = app.get(TypedConfigService)

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' })

  // `*` is a footgun in prod — it disables credentialed CORS (browsers
  // reject `Access-Control-Allow-Origin: *` with `credentials: true`)
  // AND lets any origin hit unauth endpoints. Refuse to boot with it set.
  if (cfg.env.NODE_ENV === 'production' && cfg.env.CORS_ORIGIN === '*') {
    throw new Error(
      'CORS_ORIGIN="*" is not allowed in production. Set a comma-separated allowlist.',
    )
  }
  app.enableCors({
    origin: cfg.env.CORS_ORIGIN === '*' ? true : cfg.env.CORS_ORIGIN.split(','),
    credentials: true,
    // Fastify's default advertises only GET / HEAD / POST, so PATCH
    // and DELETE preflight-fail without an explicit allowlist.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // Every custom header any browser client sends must appear here,
    // otherwise the preflight rejects and the actual request never
    // hits the controller. Includes the dashboard mode toggle plus
    // every SDK-emitted `X-Strimz-*` header (see
    // `packages/sdk/src/http/headers.ts`).
    allowedHeaders: [
      'authorization',
      'content-type',
      'accept',
      'x-strimz-mode',
      'x-strimz-sdk',
      'x-strimz-sdk-version',
      'x-strimz-sdk-runtime',
      'x-strimz-idempotency-key',
      'x-strimz-request-id',
    ],
    exposedHeaders: ['x-strimz-request-id'],
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
