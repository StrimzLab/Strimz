import { Global, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { PrivyWalletApi, TransactionSigner } from '@strimz/signer'
import { describe, expect, it, vi } from 'vitest'

import { TypedConfigService } from '../../../../src/config/index.js'
import { envSchema, validateEnv } from '../../../../src/config/env.schema.js'
import { KmsModule } from '../../../../src/infra/kms/kms.module.js'
import { KMS_SIGNER, PRIVY_WALLET_API } from '../../../../src/infra/kms/kms.tokens.js'

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    PRIVY_APP_ID: process.env.PRIVY_APP_ID ?? 'test-privy-app',
    STRIMZ_ADMIN_URL: 'http://localhost:3004',
    PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET ?? 'test-privy-secret',
    STRIMZ_WEBHOOK_SIGNING_SECRET:
      process.env.STRIMZ_WEBHOOK_SIGNING_SECRET ?? 'test-webhook-secret-at-least-32-chars-long',
    WEBHOOK_SECRET_ENCRYPTION_KEY: process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ?? 'ab'.repeat(32),
    ARC_RPC_URL: process.env.ARC_RPC_URL ?? 'http://localhost:8545',
  })
})

const RELAYER_KEY = '0x00000000000000000000000000000000000000000000000000000000000000b2'

let currentEnv: Record<string, unknown> = {}

@Global()
@Module({
  providers: [{ provide: TypedConfigService, useFactory: () => ({ env: currentEnv }) }],
  exports: [TypedConfigService],
})
class FakeConfigModule {}

const PRIVY_RELAYER = '0x00000000000000000000000000000000000000d4'
const privyApi: PrivyWalletApi = {
  walletAddress: vi.fn(() => Promise.resolve(PRIVY_RELAYER)),
  signTransaction: vi.fn(() => Promise.reject(new Error('not used here'))),
}
const PRIVY_ENV = {
  KMS_PROVIDER: 'privy',
  PRIVY_RELAYER_WALLET_ID: 'relayer-wallet',
  KMS_SIGNER_ADDRESS: PRIVY_RELAYER,
  PRIVY_SIGNER_AUTHORIZATION_KEY: 'wallet-auth:server-key',
}

async function resolveSigner(env: Record<string, unknown>): Promise<TransactionSigner> {
  currentEnv = env
  const moduleRef = await Test.createTestingModule({
    imports: [FakeConfigModule, KmsModule],
  })
    .overrideProvider(PRIVY_WALLET_API)
    .useValue(privyApi)
    .compile()
  return moduleRef.get<TransactionSigner>(KMS_SIGNER)
}

describe('KMS provider selection', () => {
  it('refuses a plaintext relayer key in production on mainnet', async () => {
    await expect(
      resolveSigner({
        NODE_ENV: 'production',
        ARC_ENVIRONMENT: 'mainnet',
        KMS_PROVIDER: 'software',
        KMS_SOFTWARE_PRIVATE_KEY: RELAYER_KEY,
      }),
    ).rejects.toThrow(/KMS_PROVIDER/u)
  })

  // ADR-2026-11-13-testnet-software-signer.
  it('signs with an explicit plaintext key in production on testnet', async () => {
    const signer = await resolveSigner({
      NODE_ENV: 'production',
      ARC_ENVIRONMENT: 'testnet',
      KMS_PROVIDER: 'software',
      KMS_SOFTWARE_PRIVATE_KEY: RELAYER_KEY,
    })
    expect(signer.address).toMatch(/^0x[0-9a-fA-F]{40}$/u)
  })

  it('never generates a relayer key in production, even on testnet', async () => {
    await expect(
      resolveSigner({
        NODE_ENV: 'production',
        ARC_ENVIRONMENT: 'testnet',
        KMS_PROVIDER: 'software',
      }),
    ).rejects.toThrow(/KMS_SOFTWARE_PRIVATE_KEY/u)
  })

  it('accepts aws-kms as a provider', () => {
    expect(envSchema.shape.KMS_PROVIDER.safeParse('aws-kms').success).toBe(true)
  })

  it('requires the key id, address and region for aws-kms', () => {
    expect(() => validateEnv({ ...process.env, KMS_PROVIDER: 'aws-kms' })).toThrow(
      /KMS_AWS_KEY_ID[\s\S]*KMS_SIGNER_ADDRESS[\s\S]*AWS_REGION/u,
    )
  })

  it('treats an empty KMS_SOFTWARE_PRIVATE_KEY line as unset under aws-kms', () => {
    expect(() =>
      validateEnv({
        ...process.env,
        KMS_PROVIDER: 'aws-kms',
        KMS_AWS_KEY_ID: 'alias/strimz-testnet-relayer',
        KMS_SIGNER_ADDRESS: '0x00000000000000000000000000000000000000c3',
        AWS_REGION: 'us-east-1',
        KMS_SOFTWARE_PRIVATE_KEY: '',
      }),
    ).not.toThrow()
  })

  it('refuses a plaintext relayer key next to an aws-kms key', () => {
    expect(() =>
      validateEnv({
        ...process.env,
        KMS_PROVIDER: 'aws-kms',
        KMS_AWS_KEY_ID: 'alias/strimz-testnet-relayer',
        KMS_SIGNER_ADDRESS: '0x00000000000000000000000000000000000000c3',
        AWS_REGION: 'us-east-1',
        KMS_SOFTWARE_PRIVATE_KEY: RELAYER_KEY,
      }),
    ).toThrow(/KMS_SOFTWARE_PRIVATE_KEY/u)
  })

  // ADR-2026-11-22-privy-server-signers.
  it('signs through the Privy wallet on mainnet', async () => {
    const signer = await resolveSigner({
      NODE_ENV: 'production',
      ARC_ENVIRONMENT: 'mainnet',
      ...PRIVY_ENV,
    })
    expect(signer.address.toLowerCase()).toBe(PRIVY_RELAYER)
    expect(privyApi.walletAddress).toHaveBeenCalledWith('relayer-wallet')
  })

  it('refuses a Privy wallet that is not the configured relayer', async () => {
    await expect(
      resolveSigner({
        NODE_ENV: 'production',
        ARC_ENVIRONMENT: 'mainnet',
        ...PRIVY_ENV,
        KMS_SIGNER_ADDRESS: '0x00000000000000000000000000000000000000e5',
      }),
    ).rejects.toThrow(/does not match/u)
  })

  it('refuses AWS KMS in production on mainnet: only Privy signs there', async () => {
    await expect(
      resolveSigner({
        NODE_ENV: 'production',
        ARC_ENVIRONMENT: 'mainnet',
        KMS_PROVIDER: 'aws-kms',
        KMS_AWS_KEY_ID: 'alias/x',
        KMS_SIGNER_ADDRESS: PRIVY_RELAYER,
        AWS_REGION: 'us-east-1',
      }),
    ).rejects.toThrow(/privy/u)
  })

  it('requires the wallet id, address and server key for privy', () => {
    expect(() => validateEnv({ ...process.env, KMS_PROVIDER: 'privy' })).toThrow(
      /PRIVY_RELAYER_WALLET_ID[\s\S]*KMS_SIGNER_ADDRESS[\s\S]*PRIVY_SIGNER_AUTHORIZATION_KEY/u,
    )
  })

  it('refuses a plaintext relayer key next to a Privy wallet', () => {
    expect(() =>
      validateEnv({ ...process.env, ...PRIVY_ENV, KMS_SOFTWARE_PRIVATE_KEY: RELAYER_KEY }),
    ).toThrow(/KMS_SOFTWARE_PRIVATE_KEY/u)
  })

  it.each(['development', 'test'])(
    'keeps the software signer when NODE_ENV=%s',
    async (NODE_ENV) => {
      const signer = await resolveSigner({
        NODE_ENV,
        KMS_PROVIDER: 'software',
        KMS_SOFTWARE_PRIVATE_KEY: RELAYER_KEY,
      })
      expect(signer.address).toMatch(/^0x[0-9a-fA-F]{40}$/u)
    },
  )
})
