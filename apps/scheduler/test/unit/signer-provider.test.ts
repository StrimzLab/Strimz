import { describe, expect, it } from 'vitest'

import { validateEnv } from '../../src/config/env.schema.js'

const SCHEDULER_KEY = '0x00000000000000000000000000000000000000000000000000000000000000a1'
const KMS_ADDRESS = '0x00000000000000000000000000000000000000c3'
const RELAYER = '0x000000000000000000000000000000000000dEaD'

function env(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    DATABASE_URL: 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: 'redis://localhost:6379',
    ARC_RPC_URL: 'http://localhost:8545',
    SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
    AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
    STRIMZ_WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-at-least-32-chars-long',
    WEBHOOK_SECRET_ENCRYPTION_KEY: 'ab'.repeat(32),
    RELAYER_ADDRESS: RELAYER,
    STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
    ...overrides,
  }
}

const awsKms = {
  SCHEDULER_SIGNER_PROVIDER: 'aws-kms',
  SCHEDULER_KMS_KEY_ID: 'arn:aws:kms:us-east-1:111122223333:key/scheduler-testnet',
  SCHEDULER_SIGNER_ADDRESS: KMS_ADDRESS,
  AWS_REGION: 'us-east-1',
}

describe('scheduler signer provider', () => {
  it('refuses a plaintext scheduler key in production', () => {
    expect(() =>
      validateEnv(env({ NODE_ENV: 'production', SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY })),
    ).toThrow(/SCHEDULER_SIGNER_PROVIDER/u)
  })

  it('starts in production with an AWS KMS key and no plaintext key', () => {
    expect(() => validateEnv(env({ NODE_ENV: 'production', ...awsKms }))).not.toThrow()
  })

  it('treats an empty SCHEDULER_PRIVATE_KEY line as unset under AWS KMS', () => {
    expect(() =>
      validateEnv(env({ NODE_ENV: 'production', ...awsKms, SCHEDULER_PRIVATE_KEY: '' })),
    ).not.toThrow()
  })

  it('refuses a plaintext scheduler key next to an AWS KMS key', () => {
    expect(() => validateEnv(env({ ...awsKms, SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY }))).toThrow(
      /SCHEDULER_PRIVATE_KEY/u,
    )
  })

  it('refuses to start without a scheduler key under the software signer', () => {
    expect(() => validateEnv(env({}))).toThrow(/SCHEDULER_PRIVATE_KEY/u)
  })

  it('refuses an AWS KMS signer address equal to the relayer', () => {
    expect(() =>
      validateEnv(env({ ...awsKms, SCHEDULER_SIGNER_ADDRESS: RELAYER.toLowerCase() })),
    ).toThrow(/RELAYER_ADDRESS/u)
  })

  it('keeps the software signer outside production', () => {
    expect(() => validateEnv(env({ SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY }))).not.toThrow()
  })
})
