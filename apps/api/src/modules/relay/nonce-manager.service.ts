import { Injectable, Logger } from '@nestjs/common'

import { ChainService } from '../../infra/chain/chain.service.js'
import { RedisService } from '../../infra/redis/redis.service.js'

/**
 * Per-(chain, hot-wallet) atomic nonce dispenser.
 *
 * The naive pattern — querying `getTransactionCount(address, 'pending')`
 * for every submission — races when multiple jobs sign concurrently.
 * Two concurrent calls both read the same pending nonce, both produce
 * a tx with that nonce, the second is rejected as "nonce too low" or
 * silently dropped.
 *
 * This manager keeps an authoritative counter in Redis, seeded once
 * from the on-chain pending nonce and incremented atomically per
 * submission. The seed-or-increment is a Lua script so it runs as a
 * single Redis round-trip with no read-modify-write race.
 *
 * Reset path: callers invoke `resync()` when the chain rejects a tx
 * for "nonce too low" / "nonce too high" so the local counter
 * re-anchors to the chain's current view.
 */
@Injectable()
export class NonceManager {
  private readonly log = new Logger(NonceManager.name)

  /**
   * Lua: if KEYS[1] is unset, seed it to ARGV[1] (the on-chain pending
   * nonce - 1); then INCR and return. Returns the nonce the caller
   * should use.
   *
   * Atomicity matters: with a plain SETNX + INCR, two workers racing
   * on a cold key can both see "not set", both seed, and one will
   * overwrite the other. The Lua wrapper makes the seed visible to
   * the INCR within the same EVAL so this can't happen.
   */
  private static readonly SEED_AND_INCR = `
    if redis.call('EXISTS', KEYS[1]) == 0 then
      redis.call('SET', KEYS[1], ARGV[1])
    end
    return redis.call('INCR', KEYS[1])
  `.trim()

  constructor(
    private readonly redis: RedisService,
    private readonly chain: ChainService,
  ) {}

  /**
   * Return the nonce to use for the next submission from `address`
   * on `chainId`. The counter advances by 1 every call — never reuses,
   * never skips — until `resync()` is called.
   */
  async acquire(chainId: number, address: `0x${string}`): Promise<bigint> {
    const key = this.key(chainId, address)
    const seed = await this.fetchPendingSeed(address)
    const result = await this.redis.client.eval(
      NonceManager.SEED_AND_INCR,
      1,
      key,
      String(seed),
    )
    // ioredis types `eval` as `unknown`; the script returns an integer.
    if (typeof result !== 'number' && typeof result !== 'string') {
      throw new Error(`NonceManager: unexpected EVAL return ${String(result)}`)
    }
    return BigInt(result)
  }

  /**
   * Re-anchor the local counter to the chain's current pending nonce.
   * Called by the worker when submission fails with "nonce too low",
   * "nonce too high", or "replacement underpriced" — any error that
   * implies our local view has drifted from the chain.
   */
  async resync(chainId: number, address: `0x${string}`): Promise<void> {
    const key = this.key(chainId, address)
    const pending = await this.chain.client.getTransactionCount({
      address,
      blockTag: 'pending',
    })
    // Set to pending-1 so the next INCR returns pending.
    await this.redis.client.set(key, String(BigInt(pending) - 1n))
    this.log.warn(`nonce resync for ${address} on chain ${chainId} -> ${pending}`)
  }

  private async fetchPendingSeed(address: `0x${string}`): Promise<bigint> {
    // Seed = (on-chain pending nonce) - 1, so the first INCR returns
    // the pending nonce itself.
    const pending = await this.chain.client.getTransactionCount({
      address,
      blockTag: 'pending',
    })
    return BigInt(pending) - 1n
  }

  private key(chainId: number, address: `0x${string}`): string {
    return `relay:nonce:${chainId}:${address.toLowerCase()}`
  }
}
