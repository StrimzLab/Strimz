/**
 * Per-chain configuration the EvmChainAdapter holds. One instance per
 * EVM chain Strimz settles on (Base, Arc, …) — instances coexist in
 * the registry.
 *
 * `contracts.*` may be empty strings during M2 when Base contracts
 * haven't been deployed yet — the adapter still registers, but any
 * call that needs a contract address throws a clear error rather than
 * sending to the zero address.
 */

export interface EvmContractAddresses {
  registry: `0x${string}`
  payments: `0x${string}`
  subscriptions: `0x${string}`
  feeCollector: `0x${string}`
  tokenWhitelist: `0x${string}`
}

export interface EvmChainConfig {
  /** Dispatch key — e.g. `evm:base`. */
  chainId: string
  /** Display label — `Base`, `Arc`. */
  display: string
  /** EIP-155 numeric chain id (8453, 5042002, …). Used by viem's chain. */
  numericChainId: number
  /** JSON-RPC URL for read paths + relayer broadcast. */
  rpcUrl: string
  /** Deployed contract addresses on this chain. */
  contracts: EvmContractAddresses
}
