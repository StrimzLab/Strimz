import type { PrismaClient } from '@strimz/db'

/**
 * Truncate every application table between tests so each spec starts clean.
 * Cheaper and more correct than `prisma migrate reset` per file. We exclude
 * `_prisma_migrations` so migration state survives.
 */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename NOT LIKE '\\_%'
         AND tablename != '_prisma_migrations'`,
  )) as Array<{ tablename: string }>
  if (rows.length === 0) return
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
}
