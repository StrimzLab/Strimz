import { describe, expect, it, vi } from 'vitest'
import { UnrecoverableError } from 'bullmq'
import { agentActionJobFixtures } from '@strimz/queue-contracts/fixtures'

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    ARC_RPC_URL: process.env.ARC_RPC_URL ?? 'http://localhost:8545',
    SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
    REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000003',
    STRIMZ_WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-at-least-32-chars-long',
    WEBHOOK_SECRET_ENCRYPTION_KEY: 'ab'.repeat(32),
    RELAYER_ADDRESS: '0x000000000000000000000000000000000000dEaD',
    STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
    CHECKOUT_ORIGIN: 'http://localhost:3002',
    SCHEDULER_PRIVATE_KEY:
      process.env.SCHEDULER_PRIVATE_KEY ??
      '0x00000000000000000000000000000000000000000000000000000000000000a1',
  })
})

import { AgentActionWorker } from '../../src/workers/agent-action/agent-action.worker.js'
import type { ChainService } from '../../src/infra/chain/chain.service.js'
import type { PrismaService } from '../../src/infra/prisma/prisma.service.js'
import type { TypedConfigService } from '../../src/config/index.js'
import { validateEnv } from '../../src/config/env.schema.js'

const JOB_TYPES = [
  'job.create-onchain',
  'job.release-onchain',
  'job.dispute-onchain',
  'job.cancel-onchain',
] as const

function worker() {
  const chain = {
    createJob: vi.fn(),
    approveAndRelease: vi.fn(),
    dispute: vi.fn(),
    cancelJob: vi.fn(),
    isSubscriptionCancelled: vi.fn(() => Promise.resolve(false)),
    cancelSubscription: vi.fn(() => Promise.resolve('0xcancel')),
  }
  const w = new AgentActionWorker(
    {} as PrismaService,
    chain as unknown as ChainService,
    { env: { AGENT_ESCROW_ADDRESS: undefined } } as unknown as TypedConfigService,
  )
  return { w, chain }
}

// ADR-2026-11-23-mainnet-without-agent-escrow.
describe('agent actions without an agent escrow', () => {
  it.each(JOB_TYPES)('%s fails for good, without touching the chain', async (type) => {
    const { w, chain } = worker()
    const err = await w
      .process({ data: agentActionJobFixtures[type] } as never)
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UnrecoverableError)
    expect(String(err)).toContain('agent_escrow_not_deployed')
    expect(chain.createJob).not.toHaveBeenCalled()
    expect(chain.approveAndRelease).not.toHaveBeenCalled()
    expect(chain.dispute).not.toHaveBeenCalled()
    expect(chain.cancelJob).not.toHaveBeenCalled()
  })

  it('still cancels subscriptions on chain', async () => {
    const { w, chain } = worker()
    const result = await w.process({
      data: agentActionJobFixtures['subscription.cancel-onchain'],
    } as never)
    expect(result.txHash).toBe('0xcancel')
    expect(chain.cancelSubscription).toHaveBeenCalledWith(7n)
  })

  it('starts without AGENT_ESCROW_ADDRESS', () => {
    const env = validateEnv({ ...process.env, AGENT_ESCROW_ADDRESS: undefined })
    expect(env.AGENT_ESCROW_ADDRESS).toBeUndefined()
  })

  it('still refuses a malformed AGENT_ESCROW_ADDRESS', () => {
    expect(() => validateEnv({ ...process.env, AGENT_ESCROW_ADDRESS: '0x123' })).toThrow(
      /AGENT_ESCROW_ADDRESS/u,
    )
  })
})
