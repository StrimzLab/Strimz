import { HttpException } from '@nestjs/common'
import helmet from '@fastify/helmet'
import rateLimit, { type errorResponseBuilderContext } from '@fastify/rate-limit'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

export const GLOBAL_RATE_LIMIT_PER_MINUTE = 600

export interface HttpPluginOverrides {
  rateLimitMax?: number
}

export async function registerHttpPlugins(
  app: NestFastifyApplication,
  overrides: HttpPluginOverrides = {},
): Promise<void> {
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(rateLimit, {
    max: overrides.rateLimitMax ?? GLOBAL_RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    errorResponseBuilder: rateLimitedResponse,
  })
}

// The plugin throws what this returns; a plain object or Error would reach the filter as a 500.
function rateLimitedResponse(_req: unknown, context: errorResponseBuilderContext): HttpException {
  return new HttpException(
    {
      code: 'rate_limited',
      message: `rate limit exceeded, retry in ${context.after}`,
      details: { retryAfterSec: Math.ceil(context.ttl / 1000) },
    },
    context.statusCode,
  )
}
