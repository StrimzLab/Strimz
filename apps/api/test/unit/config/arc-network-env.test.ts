import { describe, expect, it } from 'vitest'

import { validateEnv } from '../../../src/config/env.schema.js'

const TESTNET_EURC = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'
const MAINNET_EURC = '0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1'
const USDC = '0x3600000000000000000000000000000000000000'

const base = {
  DATABASE_URL: 'postgres://strimz:strimz@localhost:5432/strimz',
  REDIS_URL: 'redis://localhost:6379',
  PRIVY_APP_ID: 'test-privy-app',
  PRIVY_APP_SECRET: 'test-privy-secret-16',
  STRIMZ_WEBHOOK_SIGNING_SECRET: 'test-webhook-secret-at-least-32-chars-long',
  WEBHOOK_SECRET_ENCRYPTION_KEY: 'ab'.repeat(32),
  ARC_RPC_URL: 'http://localhost:8545',
}

function production(overrides: Record<string, unknown>) {
  return validateEnv({ ...base, NODE_ENV: 'production', ...overrides })
}

describe('API Arc network settings', () => {
  it.each([undefined, ''])('refuses ARC_ENVIRONMENT=%j in production', (value) => {
    expect(() => production({ ARC_ENVIRONMENT: value })).toThrow(/ARC_ENVIRONMENT/u)
  })

  it('keeps testnet as the development default', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'development' }).ARC_ENVIRONMENT).toBe('testnet')
  })

  it('takes unset token addresses from shared-config for the environment', () => {
    const env = production({ ARC_ENVIRONMENT: 'mainnet' })
    expect(env.ARC_USDC_ADDRESS).toBe(USDC)
    expect(env.ARC_EURC_ADDRESS).toBe(MAINNET_EURC)
  })

  it('refuses a token address that contradicts shared-config in production', () => {
    expect(() =>
      production({ ARC_ENVIRONMENT: 'mainnet', ARC_EURC_ADDRESS: TESTNET_EURC }),
    ).toThrow(/ARC_EURC_ADDRESS[\s\S]*0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1/u)
  })

  it('accepts the shared-config address in any letter case in production', () => {
    const env = production({
      ARC_ENVIRONMENT: 'mainnet',
      ARC_EURC_ADDRESS: MAINNET_EURC.toLowerCase(),
    })
    expect(env.ARC_EURC_ADDRESS?.toLowerCase()).toBe(MAINNET_EURC.toLowerCase())
  })

  it('allows a local token address outside production', () => {
    const local = '0x0000000000000000000000000000000000000e01'
    const env = validateEnv({ ...base, NODE_ENV: 'test', ARC_USDC_ADDRESS: local })
    expect(env.ARC_USDC_ADDRESS).toBe(local)
  })
})
