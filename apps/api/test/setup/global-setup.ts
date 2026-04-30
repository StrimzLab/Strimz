import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'

let container: StartedPostgreSqlContainer | undefined

/**
 * Vitest global setup. Runs once before any e2e file. Brings up Postgres in
 * a Docker container, runs `prisma migrate deploy` against it, then exports
 * `DATABASE_URL` and supporting env vars to the test workers via
 * `process.env`.
 *
 * Returns a teardown function that stops the container at suite end.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  // eslint-disable-next-line no-console
  console.log('[e2e] starting postgres container…')
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('strimz_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .withTmpFs({ '/var/lib/postgresql/data': 'rw' }) // ephemeral, fast
    .start()

  const url = container.getConnectionUri()

  const here = dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolve(here, '../../../..')
  const dbPkg = resolve(repoRoot, 'packages/db')

  // eslint-disable-next-line no-console
  console.log('[e2e] applying prisma migrations…')
  execSync('pnpm db:migrate:deploy', {
    cwd: dbPkg,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  })

  // Test env — keep these in sync with `apps/api/src/config/env.schema.ts`.
  // Anything that talks to a third-party service is overridden by a stub
  // provider in `test-app.factory.ts`, so the values below only need to
  // *parse*; they don't need to be valid credentials.
  process.env.NODE_ENV = 'test'
  process.env.PORT = '4001'
  process.env.LOG_LEVEL = 'error'
  process.env.API_BASE_URL = 'http://localhost:4000'
  process.env.DATABASE_URL = url
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.PRIVY_APP_ID = 'test-app-id'
  process.env.PRIVY_APP_SECRET = 'test-app-secret-at-least-16-chars'
  process.env.STRIMZ_WEBHOOK_SIGNING_SECRET = 'test-webhook-secret-at-least-32-chars-long'
  process.env.RESEND_FROM_EMAIL = 'test@strimz.test'
  process.env.ARC_ENVIRONMENT = 'testnet'
  process.env.ARC_RPC_URL = 'http://localhost:8545'
  process.env.COMPLIANCE_PROVIDER = 'disabled'
  process.env.COMPLIANCE_BLOCK_THRESHOLD = '80'
  process.env.CHECKOUT_ORIGIN = 'http://localhost:3000'
  process.env.CORS_ORIGIN = '*'

  // eslint-disable-next-line no-console
  console.log(`[e2e] postgres ready at ${url}`)

  return async () => {
    // eslint-disable-next-line no-console
    console.log('[e2e] stopping postgres container…')
    await container?.stop()
  }
}
