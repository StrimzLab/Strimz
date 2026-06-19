/**
 * Per-network configuration the `StellarChainAdapter` holds. One
 * instance per Stellar network Strimz settles on — testnet + pubnet
 * coexist in the registry.
 *
 * `contracts.*` may be empty strings when the M4 contract suite hasn't
 * been deployed to a network yet (e.g. pubnet pre-audit). The adapter
 * still registers and reports identity, but any submission method
 * will throw a clear error rather than send to the zero address.
 */

import type { StellarNetwork } from './network.js'

export interface StellarContractAddresses {
  /** Soroban C-address of the deployed `strimz-payments` contract. */
  payments: string
  /** Soroban C-address of `strimz-subscription`. */
  subscription: string
  /** Soroban C-address of `strimz-fee-collector`. */
  feeCollector: string
}

export interface StellarChainConfig {
  /** Dispatch key — e.g. `stellar:pubnet`. */
  chainId: string
  /** Display label — `Stellar`, `Stellar testnet`. */
  display: string
  /** Network identifier — drives the passphrase used for everything. */
  network: StellarNetwork
  /** Horizon HTTP endpoint for classic ops + SSE streams. */
  horizonUrl: string
  /** Stellar RPC endpoint for Soroban event streams + simulation. */
  rpcUrl: string
  /** Deployed contract addresses on this network. */
  contracts: StellarContractAddresses
  /**
   * Soroban Asset Contract (SAC) handle for USDC on this network. Lets
   * the adapter pass the USDC token contract address through to the
   * `StrimzPayments.pay(asset=…)` call without re-deriving from the
   * `(code, issuer)` pair at every send. Null until the M5c submission
   * code lands a populated value via env config.
   */
  usdcSac: string | null
}
