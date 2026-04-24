/**
 * @strimz/db
 *
 * Prisma schema and generated client for every Strimz entity.
 *
 * Consumers import the PrismaClient factory and the generated model /
 * enum types directly from this package. No one should import from the
 * `generated/` path — it is an implementation detail.
 */

export { createPrismaClient } from './client.js'
export type { CreatePrismaClientOptions } from './client.js'

// Re-export everything from the generated client so consumers can type
// their services with `Merchant`, `Subscription`, `Prisma`, `PrismaClient`, etc.
export * from '../generated/client/index.js'
