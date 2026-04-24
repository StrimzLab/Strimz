import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 configuration.
 *
 * The `datasource.url` here is used only by the Prisma CLI (migrate, studio,
 * push). The runtime client gets its connection through the
 * `@prisma/adapter-pg` driver adapter configured in `src/client.ts`.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
