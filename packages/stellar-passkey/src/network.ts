/**
 * Stellar network helpers.
 *
 * Centralises the two network passphrases so call sites don't carry
 * the string literals around. The actual deployer account is supplied
 * by the consumer (apps/web reads it from env config).
 */

export type StellarNetwork = 'testnet' | 'pubnet'

/**
 * Canonical network passphrases. These are the strings that bind a
 * Soroban contract address to its network — derive a wallet address
 * with the wrong passphrase and you get a different (unusable) contract
 * id, so this must match the network the wallet will eventually deploy
 * on.
 */
export const NETWORK_PASSPHRASE: Record<StellarNetwork, string> = {
  testnet: 'Test SDF Network ; September 2015',
  pubnet: 'Public Global Stellar Network ; September 2015',
}
