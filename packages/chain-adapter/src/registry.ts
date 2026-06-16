/**
 * Runtime registry mapping `ChainId` → `ChainAdapter` instance.
 *
 * Framework-free: a thin in-memory `Map` with typed lookup helpers.
 * apps/api wraps it as a NestJS injectable; apps/scheduler and
 * apps/agent inject it directly into their own DI systems.
 *
 * The registry is populated once at app boot from the `SupportedChain`
 * table (or environment config) — `register()` is called for each
 * enabled row. Look-ups (`get`, `getByFamily`, `list`) are O(1) and
 * suitable for the hot request path.
 *
 * Re-registering the same `chainId` overwrites; this is deliberate so
 * a hot-reload of contract addresses (or a Stellar SAC handle landing
 * mid-run) doesn't require an app restart.
 */

import { ChainNotFoundError } from './errors.js'
import type { ChainAdapter } from './ports.js'
import type { ChainFamily, ChainId } from './types.js'

export class ChainAdapterRegistry {
  private readonly adapters = new Map<ChainId, ChainAdapter>()

  /**
   * Add (or replace) an adapter. Idempotent; the last-registered
   * adapter wins for a given `chainId`. Useful for hot-reload of
   * contract config without restarting the process.
   */
  register(adapter: ChainAdapter): void {
    this.adapters.set(adapter.chainId, adapter)
  }

  /**
   * Resolve an adapter for the supplied chain id. Throws
   * `ChainNotFoundError` if no adapter is registered — callers should
   * treat this as a 4xx (`chain_not_supported`) rather than a 500.
   */
  get(chainId: ChainId): ChainAdapter {
    const adapter = this.adapters.get(chainId)
    if (!adapter) throw new ChainNotFoundError(chainId)
    return adapter
  }

  /** Non-throwing lookup; returns `null` when the chain id is unknown. */
  find(chainId: ChainId): ChainAdapter | null {
    return this.adapters.get(chainId) ?? null
  }

  /**
   * All adapters of a family — handy for the indexer-bridge that
   * subscribes to events on every EVM chain or every Stellar chain in
   * one pass.
   */
  getByFamily(family: ChainFamily): ChainAdapter[] {
    return [...this.adapters.values()].filter((a) => a.family === family)
  }

  /** All registered adapters in insertion order. */
  list(): ChainAdapter[] {
    return [...this.adapters.values()]
  }

  /** True when at least one adapter is registered for `chainId`. */
  has(chainId: ChainId): boolean {
    return this.adapters.has(chainId)
  }
}
