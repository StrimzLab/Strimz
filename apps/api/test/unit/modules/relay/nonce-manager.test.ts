import { describe, expect, it } from 'vitest'

import { NonceManager } from '../../../../src/modules/relay/nonce-manager.service.js'
import type { RedisService } from '../../../../src/infra/redis/redis.service.js'
import type { ChainService } from '../../../../src/infra/chain/chain.service.js'

/**
 * Lightweight Redis fake that implements just the surface the
 * NonceManager touches: EXISTS, GET, SET, INCR — driven by a Lua
 * script via EVAL. We re-implement the script's semantics in JS so
 * unit tests don't need a real Redis container.
 */
function makeFakeRedis(): RedisService {
  const store = new Map<string, string>()
  return {
    client: {
      async eval(_script: string, _numKeys: number, key: string, seed: string): Promise<number> {
        if (!store.has(key)) {
          store.set(key, seed)
        }
        const next = BigInt(store.get(key)!) + 1n
        store.set(key, next.toString())
        return Number(next)
      },
      async set(key: string, value: string): Promise<'OK'> {
        store.set(key, value)
        return 'OK'
      },
      async get(key: string): Promise<string | null> {
        return store.get(key) ?? null
      },
    },
  } as unknown as RedisService
}

function makeChain(pendingNonces: Record<string, number>): ChainService {
  return {
    client: {
      async getTransactionCount({ address }: { address: `0x${string}` }): Promise<number> {
        return pendingNonces[address.toLowerCase()] ?? 0
      },
      chain: { id: 5042002 },
    },
  } as unknown as ChainService
}

const ADDR = '0x0000000000000000000000000000000000beefee' as const
const ADDR_LC = ADDR.toLowerCase()

describe('NonceManager', () => {
  it('returns the chain pending nonce on the first acquire', async () => {
    const mgr = new NonceManager(makeFakeRedis(), makeChain({ [ADDR_LC]: 42 }))
    const nonce = await mgr.acquire(5042002, ADDR)
    expect(nonce).toBe(42n)
  })

  it('advances monotonically across successive acquires (no reuse, no skip)', async () => {
    const mgr = new NonceManager(makeFakeRedis(), makeChain({ [ADDR_LC]: 10 }))
    expect(await mgr.acquire(5042002, ADDR)).toBe(10n)
    expect(await mgr.acquire(5042002, ADDR)).toBe(11n)
    expect(await mgr.acquire(5042002, ADDR)).toBe(12n)
    expect(await mgr.acquire(5042002, ADDR)).toBe(13n)
  })

  it('keeps a separate counter per chain', async () => {
    const mgr = new NonceManager(
      makeFakeRedis(),
      makeChain({ [ADDR_LC]: 5 }), // same pending nonce for both chains
    )
    const a = await mgr.acquire(5042002, ADDR)
    const b = await mgr.acquire(8453, ADDR)
    expect(a).toBe(5n)
    expect(b).toBe(5n) // independent
  })

  it('keeps a separate counter per address', async () => {
    const other = '0x0000000000000000000000000000000000cafe11' as const
    const mgr = new NonceManager(
      makeFakeRedis(),
      makeChain({ [ADDR_LC]: 1, [other.toLowerCase()]: 100 }),
    )
    expect(await mgr.acquire(5042002, ADDR)).toBe(1n)
    expect(await mgr.acquire(5042002, other)).toBe(100n)
    expect(await mgr.acquire(5042002, ADDR)).toBe(2n)
    expect(await mgr.acquire(5042002, other)).toBe(101n)
  })

  it('resync re-anchors the counter to the current chain pending nonce', async () => {
    const redis = makeFakeRedis()
    const mgr = new NonceManager(redis, makeChain({ [ADDR_LC]: 10 }))
    expect(await mgr.acquire(5042002, ADDR)).toBe(10n)
    expect(await mgr.acquire(5042002, ADDR)).toBe(11n)
    // Chain advanced past our local view (e.g. another submitter): pending now 50.
    const chain = makeChain({ [ADDR_LC]: 50 })
    const m2 = new NonceManager(redis, chain)
    await m2.resync(5042002, ADDR)
    expect(await m2.acquire(5042002, ADDR)).toBe(50n)
    expect(await m2.acquire(5042002, ADDR)).toBe(51n)
  })

  it('is case-insensitive on the address key', async () => {
    const mixedCase = '0x000000000000000000000000000000000000BeEf' as `0x${string}`
    const mgr = new NonceManager(
      makeFakeRedis(),
      makeChain({ ['0x000000000000000000000000000000000000beef']: 7 }),
    )
    expect(await mgr.acquire(5042002, mixedCase)).toBe(7n)
    expect(await mgr.acquire(5042002, mixedCase)).toBe(8n)
  })
})
