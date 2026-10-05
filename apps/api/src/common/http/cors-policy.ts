import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { Env } from '../../config/env.schema.js'

export type CorsPolicy = NonNullable<Parameters<NestFastifyApplication['enableCors']>[0]>
export type CorsGroupOptions = Omit<CorsPolicy, 'delegator'>

export const PUBLIC_CORS_PREFIXES = ['/v1/checkout/', '/v1/tokens/'] as const

const EXPOSED_HEADERS = ['x-strimz-request-id']

const PUBLIC_ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'x-strimz-sdk',
  'x-strimz-sdk-version',
  'x-strimz-sdk-runtime',
  'x-strimz-request-id',
  'x-strimz-idempotency-key',
]

const ALLOWLISTED_ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'x-strimz-mode',
  'x-strimz-sdk',
  'x-strimz-sdk-version',
  'x-strimz-sdk-runtime',
  'x-strimz-idempotency-key',
  'x-strimz-request-id',
]

const PUBLIC_MAX_AGE_SECONDS = 7200
const ALLOWLISTED_MAX_AGE_SECONDS = 600

export function isPublicCorsPath(url: string): boolean {
  const queryStart = url.indexOf('?')
  const pathname = queryStart === -1 ? url : url.slice(0, queryStart)
  return PUBLIC_CORS_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function publicCorsOptions(): CorsGroupOptions {
  return {
    origin: '*',
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowedHeaders: PUBLIC_ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: PUBLIC_MAX_AGE_SECONDS,
  }
}

export function allowlistedCorsOptions(
  allowlist: readonly string[] | '*',
  requestOrigin: string | undefined,
): CorsGroupOptions {
  return {
    origin: allowlistedOrigin(allowlist, requestOrigin),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ALLOWLISTED_ALLOWED_HEADERS,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: ALLOWLISTED_MAX_AGE_SECONDS,
  }
}

function allowlistedOrigin(
  allowlist: readonly string[] | '*',
  requestOrigin: string | undefined,
): string | boolean {
  if (allowlist === '*') return true
  if (requestOrigin !== undefined && allowlist.includes(requestOrigin)) return requestOrigin
  return false
}

export function parseCorsAllowlist(corsOrigin: string): readonly string[] | '*' {
  if (corsOrigin === '*') return '*'
  return corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

export function corsPolicy(env: Pick<Env, 'CORS_ORIGIN'>): CorsPolicy {
  const allowlist = parseCorsAllowlist(env.CORS_ORIGIN)
  return {
    delegator: (req, callback) => {
      callback(
        null,
        isPublicCorsPath(req.url)
          ? publicCorsOptions()
          : allowlistedCorsOptions(allowlist, req.headers.origin),
      )
    },
  }
}
