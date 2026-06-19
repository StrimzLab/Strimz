/**
 * @strimz/chain-adapter-stellar
 *
 * Stellar family implementation of `@strimz/chain-adapter`. Today
 * (M5a): identity + StrKey address validation + capabilities.
 * Submission, indexer event subscription, and allowance refresh land
 * incrementally in M5b–e.
 */

export { StellarChainAdapter } from './adapter.js'
export { isValidStellarPayoutAddress, normaliseStellarAddress } from './address.js'
export { STELLAR_CAPABILITIES } from './capabilities.js'
export { NETWORK_PASSPHRASE, type StellarNetwork } from './network.js'
export type { StellarChainConfig, StellarContractAddresses } from './config.js'
