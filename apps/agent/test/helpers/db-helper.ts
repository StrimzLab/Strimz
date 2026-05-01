import type { PrismaClient } from '@strimz/db'

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename NOT LIKE '\\_%'
       AND tablename != '_prisma_migrations'
  `)) as Array<{ tablename: string }>
  if (rows.length === 0) return
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
}
