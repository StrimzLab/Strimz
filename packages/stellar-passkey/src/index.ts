/**
 * @strimz/stellar-passkey — framework-free entry point.
 *
 * Re-exports the deterministic wallet-address derivation helper, the
 * network passphrase map, and the Strimz brand theme tokens. React
 * components live under the `/react` subpath export so anything that
 * doesn't render UI (the API server, the indexer when it ships) can
 * import these without pulling React.
 */

export { deriveMerchantWalletAddress, type DeriveMerchantWalletInput } from './derive.js'
export { NETWORK_PASSPHRASE, type StellarNetwork } from './network.js'
export { STRIMZ_PASSKEY_THEME } from './theme.js'
