/**
 * PrismaClient factory.
 *
 * Each app (api, scheduler, agent) owns its own PrismaClient instance. This
 * factory exists so every instance is configured identically: log routing,
 * driver adapter, and any Strimz-specific extensions happen in one place.
 *
 * Prisma 7 requires a driver adapter — `new PrismaClient()` without one throws.
 */

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../generated/prisma/client.js'

export interface CreatePrismaClientOptions {
  /** Override DATABASE_URL. Defaults to `process.env.DATABASE_URL`. */
  databaseUrl?: string
  /** Log level routing. Defaults to warn+error in prod, all in dev. */
  log?: Prisma.LogLevel[]
  /** Optional node-postgres pool settings. Defaults kick in if omitted. */
  poolOptions?: {
    max?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
  }
}

export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  return new PrismaClient(buildPrismaOptions(options))
}

/**
 * Build the options object that goes into `new PrismaClient(...)`.
 * Useful for apps that want to subclass `PrismaClient` (NestJS pattern).
 */
export function buildPrismaOptions(
  options: CreatePrismaClientOptions = {},
): { adapter: PrismaPg; log: Prisma.LogLevel[] } {
  const isDev = process.env.NODE_ENV !== 'production'
  const log = options.log ?? (isDev ? ['warn', 'error'] : ['error'])

  const connectionString = options.databaseUrl ?? process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      '[@strimz/db] DATABASE_URL is not set. Provide it via env or via the `databaseUrl` option.',
    )
  }

  const adapter = new PrismaPg({ connectionString, ...options.poolOptions })
  return { adapter, log }
}
