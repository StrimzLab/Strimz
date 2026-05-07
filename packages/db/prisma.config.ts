import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 configuration.
 *
 * The `datasource.url` here is used only by the Prisma CLI (migrate,
 * studio, push). The runtime client gets its connection through the
 * `@prisma/adapter-pg` driver adapter configured in `src/client.ts`.
 *
 * The placeholder fallback exists so `prisma generate` runs in build
 * environments (CI, Docker images) without `DATABASE_URL` set —
 * generate only parses the URL, it doesn't connect. Commands that do
 * connect (migrate, push, studio) still fail loudly at connect time if
 * `DATABASE_URL` is missing or wrong, which is the intended behaviour.
 *
 * Prisma 7's `env('DATABASE_URL')` helper throws `PrismaConfigEnvError`
 * at config-load time when the var is missing, which is why we resolve
 * `process.env.DATABASE_URL` directly with a fallback instead.
 */
const PLACEHOLDER_DATABASE_URL =
  'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public'

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? PLACEHOLDER_DATABASE_URL,
  },
})
