import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'

declare const __dirname: string | undefined

let pg: StartedPostgreSqlContainer | undefined
let redis: StartedRedisContainer | undefined

export default async function globalSetup(): Promise<() => Promise<void>> {
  // eslint-disable-next-line no-console
  console.log('[agent-e2e] starting postgres + redis…')
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

  const here =
    typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(eval('import.meta.url') as string))
  const repoRoot = resolve(here, '../../../..')
  const dbPkg = resolve(repoRoot, 'packages/db')

  // eslint-disable-next-line no-console
  console.log('[agent-e2e] applying prisma migrations…')
  execSync('pnpm db:migrate:deploy', {
    cwd: dbPkg,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  })

  process.env.NODE_ENV = 'test'
  process.env.PORT = '4301'
  process.env.LOG_LEVEL = 'error'
  process.env.DATABASE_URL = dbUrl
  process.env.REDIS_URL = redisUrl
  process.env.CIRCLE_ATTESTATION_BASE_URL = 'https://iris.test'
  process.env.ARC_ENVIRONMENT = 'testnet'
  process.env.ARC_RPC_URL = 'http://localhost:8545'
  // Crons set to a never-firing date so they don't compete with manual ticks.
  process.env.RECOVERY_TICK_CRON = '0 0 0 1 1 *'
  process.env.CASHFLOW_DIGEST_CRON = '0 0 0 1 1 *'
  process.env.CASHFLOW_ANOMALY_CRON = '0 0 0 1 1 *'
  process.env.CASHFLOW_YIELD_CRON = '0 0 0 1 1 *'
  process.env.COMMERCE_MONTHLY_CRON = '0 0 0 1 1 *'
  process.env.PRICING_MONTHLY_CRON = '0 0 0 1 1 *'
  process.env.ANOMALY_THRESHOLD_LOW = '3.0'
  process.env.ANOMALY_THRESHOLD_MEDIUM = '2.0'
  process.env.ANOMALY_THRESHOLD_HIGH = '1.0'
  process.env.RESEND_FROM_EMAIL = 'noreply@strimz.test'

  // eslint-disable-next-line no-console
  console.log(`[agent-e2e] postgres at ${dbUrl}`)
  // eslint-disable-next-line no-console
  console.log(`[agent-e2e] redis at ${redisUrl}`)

  return async () => {
    // eslint-disable-next-line no-console
    console.log('[agent-e2e] tearing down containers…')
    await Promise.all([pg?.stop(), redis?.stop()])
  }
}
