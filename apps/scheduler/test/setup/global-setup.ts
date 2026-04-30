import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'

declare const __dirname: string | undefined

let pg: StartedPostgreSqlContainer | undefined
let redis: StartedRedisContainer | undefined

/**
 * Vitest global setup. Runs once. Brings up Postgres + Redis containers,
 * applies the Prisma migrations, and exports DATABASE_URL / REDIS_URL via
 * `process.env` for the test workers.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  // eslint-disable-next-line no-console
  console.log('[scheduler-e2e] starting postgres + redis…')
  ;[pg, redis] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('strimz_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
      .start(),
    new RedisContainer('redis:7-alpine').start(),
  ])

  const dbUrl = pg.getConnectionUri()
  const redisUrl = redis.getConnectionUrl()

  // Resolve repo root robustly under both CJS (typecheck) and ESM (runtime).
  // tsc with module=commonjs (the nestjs preset) doesn't permit `import.meta`,
  // so we fall back to `__dirname` if it exists.
  const here =
    typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(eval('import.meta.url') as string))
  const repoRoot = resolve(here, '../../../..')
  const dbPkg = resolve(repoRoot, 'packages/db')

  // eslint-disable-next-line no-console
  console.log('[scheduler-e2e] applying prisma migrations…')
  execSync('pnpm db:migrate:deploy', {
    cwd: dbPkg,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  })

  // Test env. Service-wallet key is a synthetic 0x01 key — fine for
  // tests because the chain client is overridden with a stub before any
  // tx broadcast happens.
  process.env.NODE_ENV = 'test'
  process.env.PORT = '4201'
  process.env.LOG_LEVEL = 'error'
  process.env.DATABASE_URL = dbUrl
  process.env.REDIS_URL = redisUrl
  process.env.ARC_ENVIRONMENT = 'testnet'
  process.env.ARC_RPC_URL = 'http://localhost:8545'
  process.env.SCHEDULER_PRIVATE_KEY =
    '0x0000000000000000000000000000000000000000000000000000000000000001'
  process.env.SUBSCRIPTIONS_ADDRESS = '0x0000000000000000000000000000000000000001'
  process.env.AGENT_ESCROW_ADDRESS = '0x0000000000000000000000000000000000000002'
  process.env.STRIMZ_WEBHOOK_SIGNING_SECRET = 'test-webhook-secret-at-least-32-chars-long'
  process.env.WEBHOOK_DELIVERY_TIMEOUT_MS = '5000'
  process.env.WEBHOOK_MAX_ATTEMPTS = '3'
  process.env.SUBSCRIPTION_SWEEPER_CRON = '0 0 0 1 1 *' // 1 Jan 00:00 — never during tests
  process.env.INVOICE_OVERDUE_CRON = '0 0 0 1 1 *'
  process.env.SUBSCRIPTION_SWEEP_LIMIT = '100'
  process.env.SUBSCRIPTION_BATCH_SIZE = '20'
  process.env.RESEND_FROM_EMAIL = 'noreply@strimz.test'

  // eslint-disable-next-line no-console
  console.log(`[scheduler-e2e] postgres at ${dbUrl}`)
  // eslint-disable-next-line no-console
  console.log(`[scheduler-e2e] redis at ${redisUrl}`)

  return async () => {
    // eslint-disable-next-line no-console
    console.log('[scheduler-e2e] tearing down containers…')
    await Promise.all([pg?.stop(), redis?.stop()])
  }
}
