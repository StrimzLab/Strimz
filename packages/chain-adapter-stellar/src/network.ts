/**
 * Stellar network identifiers, mirrored from `@strimz/stellar-passkey`
 * for adapter-side consumption. The two packages must agree on these
 * strings — the wallet contract address a passkey derives is bound to
 * the network passphrase, so a mismatch produces a different address
 * than the one that was captured at onboarding.
 *
 * We don't import from `@strimz/stellar-passkey` directly because that
 * package depends on React and is browser-targeted; the chain adapter
 * runs in Node (apps/api, apps/scheduler, apps/agent, future indexer).
 */

export type StellarNetwork = 'testnet' | 'pubnet'

export const NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  testnet: 'Test SDF Network ; September 2015',
  pubnet: 'Public Global Stellar Network ; September 2015',
}
