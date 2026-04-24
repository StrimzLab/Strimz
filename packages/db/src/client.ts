/**
 * PrismaClient factory.
 *
 * Each app (api, scheduler, agent) owns its own PrismaClient instance. This
 * factory exists so every instance is configured identically: log routing,
 * connection pool, and any Strimz-specific extensions happen in one place.
 */

import { PrismaClient, type Prisma } from '../generated/client/index.js'

export interface CreatePrismaClientOptions {
  /** Override the DATABASE_URL. Defaults to the env var. */
  databaseUrl?: string
  /** Log level routing. Defaults to warn+error in prod, all in dev. */
  log?: Prisma.LogLevel[]
  /** Extra Prisma options to pass through. */
  prismaOptions?: Prisma.PrismaClientOptions
}

export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  const isDev = process.env.NODE_ENV !== 'production'
  const log = options.log ?? (isDev ? ['warn', 'error'] : ['error'])

  return new PrismaClient({
    log,
    datasources: options.databaseUrl
      ? { db: { url: options.databaseUrl } }
      : undefined,
    ...options.prismaOptions,
  })
}
