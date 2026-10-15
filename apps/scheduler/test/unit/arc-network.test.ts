import { describe, expect, it, vi } from 'vitest'
import type { KmsSigner } from '@strimz/signer'

import type { TypedConfigService } from '../../src/config/index.js'
import { validateEnv } from '../../src/config/env.schema.js'
import { ChainService } from '../../src/infra/chain/chain.service.js'

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    ARC_RPC_URL: process.env.ARC_RPC_URL ?? 'http://localhost:8545',
    SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
    AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
    REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000003',
    STRIMZ_WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-at-least-32-chars-long',
    WEBHOOK_SECRET_ENCRYPTION_KEY: 'ab'.repeat(32),
    RELAYER_ADDRESS: '0x000000000000000000000000000000000000dEaD',
    STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
    SCHEDULER_PRIVATE_KEY:
      process.env.SCHEDULER_PRIVATE_KEY ??
      '0x00000000000000000000000000000000000000000000000000000000000000a1',
  })
})

const KMS_ADDRESS = '0x00000000000000000000000000000000000000c3'

const productionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://strimz:strimz@localhost:5432/strimz',
  REDIS_URL: 'redis://localhost:6379',
  ARC_RPC_URL: 'http://localhost:8545',
  SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
  AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
  REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000003',
  STRIMZ_WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-at-least-32-chars-long',
  WEBHOOK_SECRET_ENCRYPTION_KEY: 'ab'.repeat(32),
  RELAYER_ADDRESS: '0x000000000000000000000000000000000000dEaD',
  STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
  SCHEDULER_SIGNER_PROVIDER: 'aws-kms',
  SCHEDULER_KMS_KEY_ID: 'arn:aws:kms:us-east-1:111122223333:key/scheduler-testnet',
  SCHEDULER_SIGNER_ADDRESS: KMS_ADDRESS,
  AWS_REGION: 'us-east-1',
}

const signer: KmsSigner = {
  address: KMS_ADDRESS,
  signDigest: () => Promise.reject(new Error('not used')),
}

function chainService(env: Record<string, unknown>, rpcChainId: number) {
  const cfg = {
    env: {
      ARC_RPC_URL: 'http://localhost:8545',
      SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
      AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
      REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000003',
      ...env,
    },
  } as unknown as TypedConfigService
  const service = new ChainService(cfg, signer)
  const getChainId = vi.spyOn(service.publicClient, 'getChainId').mockResolvedValue(rpcChainId)
  return { service, getChainId }
}

describe('scheduler Arc network settings', () => {
  it('refuses an unset ARC_ENVIRONMENT in production', () => {
    expect(() => validateEnv(productionEnv)).toThrow(/ARC_ENVIRONMENT/u)
  })

  it('refuses to start without the registry address the plan upgrade writes to', () => {
    const { REGISTRY_ADDRESS: _omitted, ...withoutRegistry } = productionEnv
    expect(() => validateEnv({ ...withoutRegistry, ARC_ENVIRONMENT: 'testnet' })).toThrow(
      /REGISTRY_ADDRESS/u,
    )
  })

  it('starts in production with ARC_ENVIRONMENT set', () => {
    expect(validateEnv({ ...productionEnv, ARC_ENVIRONMENT: 'mainnet' }).ARC_ENVIRONMENT).toBe(
      'mainnet',
    )
  })
})

describe('scheduler chain id check at boot', () => {
  it('refuses to start in production when the RPC serves another chain', async () => {
    const { service } = chainService(
      { NODE_ENV: 'production', ARC_ENVIRONMENT: 'mainnet' },
      5042002,
    )
    await expect(service.onModuleInit()).rejects.toThrow(
      /5042002[\s\S]*5042\b|5042\b[\s\S]*5042002/u,
    )
  })

  it('starts in production when the RPC serves the expected chain', async () => {
    const { service } = chainService({ NODE_ENV: 'production', ARC_ENVIRONMENT: 'mainnet' }, 5042)
    await expect(service.onModuleInit()).resolves.toBeUndefined()
  })

  it('does not call the RPC outside production', async () => {
    const { service, getChainId } = chainService(
      { NODE_ENV: 'test', ARC_ENVIRONMENT: 'testnet' },
      1,
    )
    await service.onModuleInit()
    expect(getChainId).not.toHaveBeenCalled()
  })
})
