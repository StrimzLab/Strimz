import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { ChainAdapterRegistry, type ChainAdapter } from '@strimz/chain-adapter'
import { EvmChainAdapter, type EvmChainConfig } from '@strimz/chain-adapter-evm'
import {
  StellarChainAdapter,
  type StellarChainConfig,
  type StellarNetwork,
} from '@strimz/chain-adapter-stellar'

import { PrismaService } from '../prisma/prisma.service.js'

/**
 * Nest wrapper around `@strimz/chain-adapter`'s `ChainAdapterRegistry`.
 *
 * On boot:
 *   1. Reads the enabled rows from `SupportedChain`.
 *   2. For each row, dispatches to the family-specific builder:
 *      - EVM → `EvmChainAdapter` against `rpcConfig.{chainId, rpcUrlEnv,
 *        contracts}`
 *      - Stellar → `StellarChainAdapter` against `rpcConfig.{network,
 *        horizonUrl, rpcUrl, contracts, usdcSac}`
 *   3. Skips rows whose contracts are empty (e.g. `evm:base` until the
 *      deploy lands, or `stellar:pubnet` until audit completes) — logs
 *      once at warn so the operator surface is visible.
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
      const adapter =
        row.family === 'evm'
          ? this.buildEvmAdapter(row.id, row.display, row.rpcConfig)
          : row.family === 'stellar'
            ? this.buildStellarAdapter(row.id, row.display, row.rpcConfig)
            : null
      if (!adapter) {
        skipped++
        continue
      }
      this.register(adapter)
      registered++
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
   * Build a `StellarChainAdapter` from a SupportedChain row's
   * `rpcConfig`. Returns `null` when contract addresses haven't been
   * populated yet (M4 deploy still pending for the network). The
   * adapter's identity surface (`chainId`, `family`, `capabilities`)
   * is usable today; submission methods throw
   * `AdapterNotImplementedError` until M5b–e land.
   */
  private buildStellarAdapter(
    chainId: string,
    display: string,
    rpcConfig: unknown,
  ): StellarChainAdapter | null {
    const parsed = parseStellarConfig(rpcConfig)
    if (!parsed) {
      this.log.warn(`chain ${chainId}: rpcConfig is not a valid Stellar shape; skipping`)
      return null
    }
    if (!parsed.contracts.payments || !parsed.contracts.subscription) {
      this.log.warn(
        `chain ${chainId}: Soroban contracts not yet deployed (payments/subscription empty); skipping`,
      )
      return null
    }

    const config: StellarChainConfig = {
      chainId,
      display,
      network: parsed.network,
      horizonUrl: parsed.horizonUrl,
      rpcUrl: parsed.rpcUrl,
      contracts: {
        payments: parsed.contracts.payments,
        subscription: parsed.contracts.subscription,
        feeCollector: parsed.contracts.feeCollector,
      },
      usdcSac: parsed.usdcSac,
    }
    return new StellarChainAdapter(config)
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

interface ParsedStellarConfig {
  network: StellarNetwork
  horizonUrl: string
  rpcUrl: string
  contracts: {
    payments: string
    subscription: string
    feeCollector: string
  }
  usdcSac: string | null
}

function parseStellarConfig(raw: unknown): ParsedStellarConfig | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  const network = obj.network === 'testnet' || obj.network === 'pubnet' ? obj.network : null
  const horizonUrl = typeof obj.horizonUrl === 'string' ? obj.horizonUrl : null
  const rpcUrl = typeof obj.rpcUrl === 'string' ? obj.rpcUrl : null
  if (!network || !horizonUrl || !rpcUrl) return null

  const contractsRaw =
    typeof obj.contracts === 'object' && obj.contracts !== null
      ? (obj.contracts as Record<string, unknown>)
      : {}
  const payments = typeof contractsRaw.payments === 'string' ? contractsRaw.payments : ''
  const subscription =
    typeof contractsRaw.subscription === 'string' ? contractsRaw.subscription : ''
  const feeCollector =
    typeof contractsRaw.feeCollector === 'string' ? contractsRaw.feeCollector : ''
  const usdcSac = typeof obj.usdcSac === 'string' ? obj.usdcSac : null

  return {
    network,
    horizonUrl,
    rpcUrl,
    contracts: { payments, subscription, feeCollector },
    usdcSac,
  }
}
