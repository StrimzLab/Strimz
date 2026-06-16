import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ChainAdapterRegistry, type ChainAdapter } from '@strimz/chain-adapter'
import { EvmChainAdapter, type EvmChainConfig } from '@strimz/chain-adapter-evm'

import { PrismaService } from '../prisma/prisma.service.js'

/**
 * Nest wrapper around `@strimz/chain-adapter`'s `ChainAdapterRegistry`.
 *
 * On boot:
 *   1. Reads the enabled rows from `SupportedChain`.
 *   2. For each EVM row, builds an `EvmChainConfig` from its `rpcConfig`
 *      + environment variables, and registers an `EvmChainAdapter`.
 *   3. Skips rows whose contracts are empty (e.g. `evm:base` until the
 *      deploy lands) — logs once at warn so the operator surface is
 *      visible.
 *
 * Stellar rows are not registered yet — the Stellar adapter ships in
 * M5. They sit in the registry as "known but unhandled"; any call
 * targeting them surfaces a `chain_not_found` 4xx until then.
 *
 * Re-registration mid-process is safe — useful when the admin
 * platform updates a chain's contract addresses without a restart.
 */
@Injectable()
export class ChainRegistryService extends ChainAdapterRegistry implements OnModuleInit {
  private readonly log = new Logger(ChainRegistryService.name)

  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async onModuleInit(): Promise<void> {
    const rows = await this.prisma.db.supportedChain.findMany({
      where: { enabled: true },
      orderBy: { id: 'asc' },
    })

    let registered = 0
    let skipped = 0
    for (const row of rows) {
      if (row.family === 'evm') {
        const adapter = this.buildEvmAdapter(row.id, row.display, row.rpcConfig)
        if (!adapter) {
          skipped++
          continue
        }
        this.register(adapter)
        registered++
        continue
      }

      // Stellar adapters arrive in M5. Recording the skip so a future
      // M5 PR can confirm it stops appearing.
      this.log.log(
        `chain ${row.id} (${row.family}) recognised but no adapter implementation is wired yet`,
      )
      skipped++
    }

    this.log.log(`chain-registry boot: ${registered} adapter(s) registered, ${skipped} skipped`)
  }

  /**
   * Build an `EvmChainAdapter` from a SupportedChain row's `rpcConfig`.
   * Returns `null` when the row isn't usable yet — e.g. the RPC URL
   * env var is unset, or no contract addresses are configured. The
   * caller logs at warn so the operator can see the gap.
   */
  private buildEvmAdapter(
    chainId: string,
    display: string,
    rpcConfig: unknown,
  ): EvmChainAdapter | null {
    const parsed = parseEvmConfig(rpcConfig)
    if (!parsed) {
      this.log.warn(`chain ${chainId}: rpcConfig is not a valid EVM shape; skipping`)
      return null
    }

    const rpcUrl = process.env[parsed.rpcUrlEnv]
    if (!rpcUrl) {
      this.log.warn(`chain ${chainId}: ${parsed.rpcUrlEnv} not set; skipping adapter registration`)
      return null
    }

    const contracts = parsed.contracts
    if (!contracts.payments || !contracts.subscriptions) {
      this.log.warn(
        `chain ${chainId}: contracts not yet deployed (payments/subscriptions empty); skipping`,
      )
      return null
    }

    const config: EvmChainConfig = {
      chainId,
      display,
      numericChainId: parsed.numericChainId,
      rpcUrl,
      contracts: {
        registry: contracts.registry as `0x${string}`,
        payments: contracts.payments as `0x${string}`,
        subscriptions: contracts.subscriptions as `0x${string}`,
        feeCollector: contracts.feeCollector as `0x${string}`,
        tokenWhitelist: contracts.tokenWhitelist as `0x${string}`,
      },
    }
    return new EvmChainAdapter(config)
  }

  /**
   * Convenience method matching the (synchronous) `get` semantics of
   * the underlying registry but returning the typed adapter shape.
   */
  resolve(chainId: string): ChainAdapter {
    return this.get(chainId)
  }
}

// ---------- Helpers ----------

interface ParsedEvmConfig {
  numericChainId: number
  rpcUrlEnv: string
  contracts: {
    registry?: string
    payments?: string
    subscriptions?: string
    feeCollector?: string
    tokenWhitelist?: string
  }
}

function parseEvmConfig(raw: unknown): ParsedEvmConfig | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  const numericChainId = typeof obj.chainId === 'number' ? obj.chainId : null
  const rpcUrlEnv = typeof obj.rpcUrlEnv === 'string' ? obj.rpcUrlEnv : null
  if (numericChainId === null || rpcUrlEnv === null) return null
  const contracts =
    typeof obj.contracts === 'object' && obj.contracts !== null
      ? (obj.contracts as Record<string, string>)
      : {}
  return { numericChainId, rpcUrlEnv, contracts }
}
