import type { ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'
import { createPrismaClient } from '@strimz/db'
import { ARC_TESTNET_CHAIN_ID } from '@strimz/shared-config'
import { generateAesGcmKey } from '@strimz/shared-crypto'
import type { GlobalSetupContext } from 'vitest/node'
import { createActors, deploy, fundUsdc, startFork, type Actors, type Deployment } from './chain.js'
import { httpOk, LogSink, REPO_ROOT, run, startService, stopAll, waitFor } from './process.js'
import { seedMerchant, type SeededMerchant } from './seed.js'

declare module 'vitest' {
  export interface ProvidedContext {
    apiUrl: string
    databaseUrl: string
    deployment: Deployment
    merchant: SeededMerchant
    merchants: SeededMerchant[]
    actors: Actors
    scheduler: { pid: number; cwd: string; env: Record<string, string>; readyUrl: string }
  }
}

const ANVIL_PORT = 18645
const API_PORT = 14000
const SCHEDULER_PORT = 14200
const INDEXER_PORT = 14300
const PAYER_FUNDING_USDC = 100n
const SERVICE_FUNDING_USDC = 1_000n

// Merchants are registered on-chain before the api starts, so the relayer key is
// never used by two processes at once.
function merchantCount(): number {
  const raw = process.env.E2E_MERCHANTS ?? '1'
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 20) {
    throw new Error(`E2E_MERCHANTS must be an integer from 1 to 20, got ${raw}`)
  }
  return n
}

export default async function setup({ provide }: GlobalSetupContext): Promise<() => Promise<void>> {
  const forkUrl = process.env.ARC_TESTNET_RPC_URL
  if (!forkUrl)
    throw new Error('ARC_TESTNET_RPC_URL must point at Arc testnet; the stack runs on a fork of it')

  const log = new LogSink()
  const children: Array<ChildProcess | undefined> = []
  let pg: StartedPostgreSqlContainer | undefined
  let redis: StartedRedisContainer | undefined

  const teardown = async () => {
    await stopAll(children)
    await Promise.all([pg?.stop(), redis?.stop()])
    log.close()
  }

  try {
    ;[pg, redis] = await Promise.all([
      new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('strimz_full_stack')
        .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
        .start(),
      new RedisContainer('redis:7-alpine').start(),
    ])
    const databaseUrl = pg.getConnectionUri()
    const redisUrl = redis.getConnectionUrl()
    await run('pnpm', ['db:migrate:deploy'], {
      cwd: join(REPO_ROOT, 'packages/db'),
      env: { DATABASE_URL: databaseUrl },
      log,
      label: 'migrate',
    })

    children.push(await startFork(forkUrl, ANVIL_PORT, log))
    const rpcUrl = `http://127.0.0.1:${ANVIL_PORT}`
    const actors = createActors()
    await fundUsdc(rpcUrl, actors.deployer.address, SERVICE_FUNDING_USDC)
    const deployment = await deploy(rpcUrl, actors, log)
    for (const who of [actors.relayer.address, actors.scheduler.address, actors.payout.address]) {
      await fundUsdc(rpcUrl, who, SERVICE_FUNDING_USDC)
    }
    await fundUsdc(rpcUrl, actors.payer.address, PAYER_FUNDING_USDC)

    const webhookEncryptionKey = generateAesGcmKey()
    const webhookSigningSecret = `full-stack-${generateAesGcmKey()}`
    const prisma = createPrismaClient({ databaseUrl })
    const merchants: SeededMerchant[] = []
    try {
      for (let i = 0; i < merchantCount(); i++) {
        merchants.push(await seedMerchant(prisma, deployment, actors, webhookEncryptionKey))
      }
    } finally {
      await prisma.$disconnect()
    }
    const [merchant] = merchants
    if (!merchant) throw new Error('no merchant seeded')

    const indexer = startService('indexer', join(REPO_ROOT, 'apps/indexer/bin/indexer'), ['run'], {
      cwd: join(REPO_ROOT, 'apps/indexer'),
      requires: 'bin/indexer',
      log,
      env: {
        ARC_ENVIRONMENT: 'testnet',
        ARC_CHAIN_ID: String(ARC_TESTNET_CHAIN_ID),
        ARC_RPC_URL: rpcUrl,
        DATABASE_URL: databaseUrl,
        CONFIRMATIONS: '0',
        START_BLOCK: String(deployment.startBlock),
        POLL_INTERVAL_MS: '500',
        HTTP_PORT: String(INDEXER_PORT),
        REGISTRY_ADDRESS: deployment.registry,
        PAYMENTS_ADDRESS: deployment.payments,
        SUBSCRIPTIONS_ADDRESS: deployment.subscriptions,
        AGENT_ESCROW_ADDRESS: deployment.agentEscrow,
        FEE_COLLECTOR_ADDRESS: deployment.feeCollector,
        TOKEN_WHITELIST_ADDRESS: deployment.tokenWhitelist,
        AGENT_REGISTRY_ADDRESS: deployment.agentRegistry,
        TIMELOCK_ADDRESS: deployment.timelock,
        STABLECOIN_ADDRESSES: `USDC:${deployment.usdc},EURC:${deployment.eurc}`,
      },
    })
    children.push(indexer.child)

    const shared = {
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      ARC_ENVIRONMENT: 'testnet',
      ARC_RPC_URL: rpcUrl,
      ARC_USDC_ADDRESS: deployment.usdc,
      STRIMZ_WEBHOOK_SIGNING_SECRET: webhookSigningSecret,
      WEBHOOK_SECRET_ENCRYPTION_KEY: webhookEncryptionKey,
    }

    const api = startService('api', 'node', ['dist/main.js'], {
      cwd: join(REPO_ROOT, 'apps/api'),
      requires: 'dist/main.js',
      log,
      env: {
        ...shared,
        PORT: String(API_PORT),
        API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
        PRIVY_APP_ID: 'full-stack-e2e',
        PRIVY_APP_SECRET: 'full-stack-e2e-not-a-real-secret',
        ARC_EURC_ADDRESS: deployment.eurc,
        STRIMZ_REGISTRY_ADDRESS: deployment.registry,
        STRIMZ_PAYMENTS_ADDRESS: deployment.payments,
        STRIMZ_SUBSCRIPTIONS_ADDRESS: deployment.subscriptions,
        STRIMZ_FEE_COLLECTOR_ADDRESS: deployment.feeCollector,
        STRIMZ_TOKEN_WHITELIST_ADDRESS: deployment.tokenWhitelist,
        KMS_PROVIDER: 'software',
        KMS_SOFTWARE_PRIVATE_KEY: actors.relayer.privateKey,
        COMPLIANCE_PROVIDER: 'disabled',
        OPS_ALERT_EMAIL: 'ops@strimz.test',
      },
    })
    children.push(api.child)

    const schedulerEnv: Record<string, string> = {
      ...shared,
      PORT: String(SCHEDULER_PORT),
      SCHEDULER_SIGNER_PROVIDER: 'software',
      SCHEDULER_PRIVATE_KEY: actors.scheduler.privateKey,
      SUBSCRIPTIONS_ADDRESS: deployment.subscriptions,
      AGENT_ESCROW_ADDRESS: deployment.agentEscrow,
      REGISTRY_ADDRESS: deployment.registry,
      RELAYER_ADDRESS: actors.relayer.address,
      STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
      SUBSCRIPTION_SWEEPER_CRON: '*/5 * * * * *',
    }
    const schedulerCwd = join(REPO_ROOT, 'apps/scheduler')
    const scheduler = startService('scheduler', 'node', ['dist/main.js'], {
      cwd: schedulerCwd,
      requires: 'dist/main.js',
      log,
      env: schedulerEnv,
    })
    children.push(scheduler.child)

    const apiUrl = `http://127.0.0.1:${API_PORT}`
    await Promise.all([
      waitFor('indexer', 60_000, () => httpOk(`http://127.0.0.1:${INDEXER_PORT}/readyz`)),
      waitFor('api', 60_000, () => httpOk(`${apiUrl}/ready`)),
      waitFor('scheduler', 60_000, () => httpOk(`http://127.0.0.1:${SCHEDULER_PORT}/readyz`)),
    ])

    provide('apiUrl', apiUrl)
    provide('databaseUrl', databaseUrl)
    provide('deployment', deployment)
    provide('merchant', merchant)
    provide('merchants', merchants)
    provide('actors', actors)
    const schedulerPid = scheduler.child.pid
    if (schedulerPid === undefined) throw new Error('scheduler has no pid')
    provide('scheduler', {
      pid: schedulerPid,
      cwd: schedulerCwd,
      env: schedulerEnv,
      readyUrl: `http://127.0.0.1:${SCHEDULER_PORT}/readyz`,
    })
    return teardown
  } catch (err) {
    await teardown()
    throw err
  }
}
