import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma's prisma.config.ts does not auto-load .env the way the deprecated
// `package.json#prisma` entry did. Node 22 has this natively.
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile()
  } catch {
    // .env is optional — apps pass DATABASE_URL via their own env in prod.
  }
}

/**
 * Prisma config — supersedes `package.json#prisma` (deprecated in Prisma 7).
 *
 * Strimz uses a multi-file schema under `prisma/schema/`.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema'),
})
