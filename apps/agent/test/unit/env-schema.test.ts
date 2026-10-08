import { describe, expect, it } from 'vitest'
import { envSchema, validateEnv } from '../../src/config/env.schema.js'

const required = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/strimz',
  REDIS_URL: 'redis://localhost:6379',
}

describe('agent env schema', () => {
  it('boots without ARC_RPC_URL, which the agent never reads', () => {
    expect(() => validateEnv(required)).not.toThrow()
  })

  it('does not declare ARC_RPC_URL', () => {
    expect(Object.keys(envSchema.shape)).not.toContain('ARC_RPC_URL')
  })
})
