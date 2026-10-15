import { describe, expect, it } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'

import { validateEnv } from '../../src/config/env.schema.js'

const SCHEDULER_KEY = '0x00000000000000000000000000000000000000000000000000000000000000a1'
const SCHEDULER_ADDRESS = privateKeyToAccount(SCHEDULER_KEY).address

function env(overrides: Record<string, string>): Record<string, string> {
  return {
    DATABASE_URL: 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: 'redis://localhost:6379',
    ARC_RPC_URL: 'http://localhost:8545',
    SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY,
    SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
    AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
    REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000003',
    STRIMZ_WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-at-least-32-chars-long',
    WEBHOOK_SECRET_ENCRYPTION_KEY: 'ab'.repeat(32),
    RELAYER_ADDRESS: '0x000000000000000000000000000000000000dEaD',
    STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
    ...overrides,
  }
}

describe('scheduler signer separation', () => {
  it('starts when the scheduler signer and the API relayer are different keys', () => {
    expect(() => validateEnv(env({}))).not.toThrow()
  })

  it('refuses to start when the scheduler signer is the API relayer', () => {
    expect(() => validateEnv(env({ RELAYER_ADDRESS: SCHEDULER_ADDRESS }))).toThrow(
      /RELAYER_ADDRESS/u,
    )
  })

  it('compares addresses without regard to checksum case', () => {
    expect(() => validateEnv(env({ RELAYER_ADDRESS: SCHEDULER_ADDRESS.toLowerCase() }))).toThrow(
      /RELAYER_ADDRESS/u,
    )
  })
})
