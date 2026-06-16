/**
 * @strimz/chain-adapter-evm
 *
 * EVM-family implementation of `@strimz/chain-adapter`.
 *
 * Today: identity + address validation. Subsequent milestones move
 * the relayer logic from `apps/api/src/modules/relay/` into this
 * package and flesh out the prepare/submit methods.
 */

export { EvmChainAdapter } from './adapter.js'
export { isValidEvmAddress, checksumEvmAddress } from './address.js'
export { EVM_CAPABILITIES } from './capabilities.js'
export type { EvmChainConfig, EvmContractAddresses } from './config.js'
