import { Global, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { KmsSigner } from '@strimz/signer'
import { describe, expect, it, vi } from 'vitest'

import { TypedConfigService } from '../../../../src/config/index.js'
import { envSchema, validateEnv } from '../../../../src/config/env.schema.js'
import { KmsModule } from '../../../../src/infra/kms/kms.module.js'
import { KMS_SIGNER } from '../../../../src/infra/kms/kms.tokens.js'

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    PRIVY_APP_ID: process.env.PRIVY_APP_ID ?? 'test-privy-app',
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

async function resolveSigner(env: Record<string, unknown>): Promise<KmsSigner> {
  currentEnv = env
  const moduleRef = await Test.createTestingModule({
    imports: [FakeConfigModule, KmsModule],
  }).compile()
  return moduleRef.get<KmsSigner>(KMS_SIGNER)
}

describe('KMS provider selection', () => {
  it('refuses a plaintext relayer key in production', async () => {
    await expect(
      resolveSigner({
        NODE_ENV: 'production',
        KMS_PROVIDER: 'software',
        KMS_SOFTWARE_PRIVATE_KEY: RELAYER_KEY,
      }),
    ).rejects.toThrow(/KMS_PROVIDER/u)
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
