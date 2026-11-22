import { describe, expect, it, vi } from 'vitest'
import type { PrivyWalletApi } from '@strimz/signer'

import { schedulerSignerProvider } from '../../src/infra/chain/scheduler-signer.js'
import { refundSignerProvider } from '../../src/infra/refund-chain/refund-signer.js'
import type { TypedConfigService } from '../../src/config/index.js'

import { validateEnv } from '../../src/config/env.schema.js'

// The signer factories import the config module, which validates process.env on load.
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
    CHECKOUT_ORIGIN: 'http://localhost:3002',
    SCHEDULER_PRIVATE_KEY:
      process.env.SCHEDULER_PRIVATE_KEY ??
      '0x00000000000000000000000000000000000000000000000000000000000000a1',
  })
})

const SCHEDULER_KEY = '0x00000000000000000000000000000000000000000000000000000000000000a1'
const KMS_ADDRESS = '0x00000000000000000000000000000000000000c3'
const RELAYER = '0x000000000000000000000000000000000000dEaD'
const REFUND_KEY = '0x00000000000000000000000000000000000000000000000000000000000000b2'

function env(overrides: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    DATABASE_URL: 'postgres://strimz:strimz@localhost:5432/strimz',
    REDIS_URL: 'redis://localhost:6379',
    ARC_ENVIRONMENT: 'testnet',
    ARC_RPC_URL: 'http://localhost:8545',
    SUBSCRIPTIONS_ADDRESS: '0x0000000000000000000000000000000000000001',
    AGENT_ESCROW_ADDRESS: '0x0000000000000000000000000000000000000002',
    REGISTRY_ADDRESS: '0x0000000000000000000000000000000000000003',
    STRIMZ_WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-at-least-32-chars-long',
    WEBHOOK_SECRET_ENCRYPTION_KEY: 'ab'.repeat(32),
    RELAYER_ADDRESS: RELAYER,
    STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
    CHECKOUT_ORIGIN: 'http://localhost:3002',
    REFUND_SIGNER_PROVIDER: 'software',
    REFUND_PRIVATE_KEY: REFUND_KEY,
    ...overrides,
  }
}

const awsKms = {
  SCHEDULER_SIGNER_PROVIDER: 'aws-kms',
  SCHEDULER_KMS_KEY_ID: 'arn:aws:kms:us-east-1:111122223333:key/scheduler-testnet',
  SCHEDULER_SIGNER_ADDRESS: KMS_ADDRESS,
  AWS_REGION: 'us-east-1',
}

const PRIVY_SCHEDULER = '0x00000000000000000000000000000000000000e1'
const PRIVY_REFUND = '0x00000000000000000000000000000000000000e2'
const privy = {
  SCHEDULER_SIGNER_PROVIDER: 'privy',
  PRIVY_SCHEDULER_WALLET_ID: 'scheduler-wallet',
  SCHEDULER_SIGNER_ADDRESS: PRIVY_SCHEDULER,
  REFUND_SIGNER_PROVIDER: 'privy',
  REFUND_PRIVATE_KEY: undefined,
  PRIVY_REFUND_WALLET_ID: 'refund-wallet',
  REFUND_SIGNER_ADDRESS: PRIVY_REFUND,
  PRIVY_APP_ID: 'app',
  PRIVY_APP_SECRET: 'secret',
  PRIVY_SIGNER_AUTHORIZATION_KEY: 'wallet-auth:server-key',
}

// ADR-2026-11-22-privy-server-signers.
describe('Privy signers', () => {
  it('starts in production on mainnet with Privy wallets for both', () => {
    expect(() =>
      validateEnv(env({ NODE_ENV: 'production', ARC_ENVIRONMENT: 'mainnet', ...privy })),
    ).not.toThrow()
  })

  it('refuses AWS KMS on mainnet: only Privy signs there', () => {
    expect(() =>
      validateEnv(env({ NODE_ENV: 'production', ARC_ENVIRONMENT: 'mainnet', ...privy, ...awsKms })),
    ).toThrow(/SCHEDULER_SIGNER_PROVIDER/u)
  })

  it('needs the wallet ids, addresses, app credentials and server key', () => {
    expect(() =>
      validateEnv(
        env({
          SCHEDULER_SIGNER_PROVIDER: 'privy',
          REFUND_SIGNER_PROVIDER: 'privy',
          REFUND_PRIVATE_KEY: undefined,
        }),
      ),
    ).toThrow(
      /PRIVY_SCHEDULER_WALLET_ID[\s\S]*SCHEDULER_SIGNER_ADDRESS[\s\S]*PRIVY_REFUND_WALLET_ID[\s\S]*REFUND_SIGNER_ADDRESS[\s\S]*PRIVY_APP_ID[\s\S]*PRIVY_APP_SECRET[\s\S]*PRIVY_SIGNER_AUTHORIZATION_KEY/u,
    )
  })

  it('refuses the same Privy wallet for the scheduler and refunds', () => {
    expect(() => validateEnv(env({ ...privy, REFUND_SIGNER_ADDRESS: PRIVY_SCHEDULER }))).toThrow(
      /refund wallet must be its own key/u,
    )
  })

  it('connects each signer to its own Privy wallet', async () => {
    const addresses: Record<string, string> = {
      'scheduler-wallet': PRIVY_SCHEDULER,
      'refund-wallet': PRIVY_REFUND,
    }
    const api: PrivyWalletApi = {
      walletAddress: vi.fn((id: string) => Promise.resolve(addresses[id] ?? '0x0')),
      signTransaction: vi.fn(() => Promise.reject(new Error('not used here'))),
    }
    const cfg = { env: validateEnv(env(privy)) } as unknown as TypedConfigService
    const scheduler = await schedulerSignerProvider.useFactory(cfg, api)
    const refund = await refundSignerProvider.useFactory(cfg, api)
    expect(scheduler.address.toLowerCase()).toBe(PRIVY_SCHEDULER)
    expect(refund?.address.toLowerCase()).toBe(PRIVY_REFUND)
  })
})

describe('scheduler signer provider', () => {
  it('refuses a plaintext scheduler key in production on mainnet', () => {
    expect(() =>
      validateEnv(
        env({
          NODE_ENV: 'production',
          ARC_ENVIRONMENT: 'mainnet',
          SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY,
        }),
      ),
    ).toThrow(/SCHEDULER_SIGNER_PROVIDER/u)
  })

  // ADR-2026-11-13-testnet-software-signer.
  it('accepts an explicit plaintext scheduler key in production on testnet', () => {
    expect(() =>
      validateEnv(env({ NODE_ENV: 'production', SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY })),
    ).not.toThrow()
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

  // ADR-2026-11-21-free-plan-fee-integrity: the refund wallet.
  describe('refund wallet', () => {
    it('is required in production, because merchants are owed refunds', () => {
      expect(() =>
        validateEnv(
          env({
            NODE_ENV: 'production',
            SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY,
            REFUND_SIGNER_PROVIDER: undefined,
            REFUND_PRIVATE_KEY: undefined,
          }),
        ),
      ).toThrow(/REFUND_SIGNER_PROVIDER/u)
    })

    it('refuses a plaintext refund key in production on mainnet', () => {
      expect(() =>
        validateEnv(env({ NODE_ENV: 'production', ARC_ENVIRONMENT: 'mainnet', ...awsKms })),
      ).toThrow(/REFUND_SIGNER_PROVIDER/u)
    })

    it('refuses a refund key that is the scheduler key', () => {
      expect(() =>
        validateEnv(
          env({ SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY, REFUND_PRIVATE_KEY: SCHEDULER_KEY }),
        ),
      ).toThrow(/refund wallet must be its own key/u)
    })

    it('needs the KMS key id, address and region under aws-kms', () => {
      expect(() =>
        validateEnv(
          env({
            SCHEDULER_PRIVATE_KEY: SCHEDULER_KEY,
            REFUND_SIGNER_PROVIDER: 'aws-kms',
            REFUND_PRIVATE_KEY: undefined,
          }),
        ),
      ).toThrow(/REFUND_KMS_KEY_ID/u)
    })
  })
})
