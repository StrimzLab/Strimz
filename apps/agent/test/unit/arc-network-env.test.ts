import { describe, expect, it } from 'vitest'
import { validateEnv } from '../../src/config/env.schema.js'

const required = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/strimz',
  REDIS_URL: 'redis://localhost:6379',
}

describe('agent Arc network settings', () => {
  it.each([undefined, ''])('refuses ARC_ENVIRONMENT=%j in production', (value) => {
    expect(() =>
      validateEnv({ ...required, NODE_ENV: 'production', ARC_ENVIRONMENT: value }),
    ).toThrow(/ARC_ENVIRONMENT/u)
  })

  it('starts in production with ARC_ENVIRONMENT set', () => {
    expect(
      validateEnv({ ...required, NODE_ENV: 'production', ARC_ENVIRONMENT: 'mainnet' })
        .ARC_ENVIRONMENT,
    ).toBe('mainnet')
  })

  it('keeps testnet as the development default', () => {
    expect(validateEnv(required).ARC_ENVIRONMENT).toBe('testnet')
  })
})
