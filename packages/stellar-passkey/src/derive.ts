/**
 * Smart-wallet address derivation for Strimz merchants.
 *
 * The wallet is a Soroban contract deployed at an address derived from
 * (deployer, salt). `stellar-passkeyUI` uses the passkey credential id
 * as the salt source, mirroring the passkey-kit lineage — one passkey
 * binds to one predictable contract address. We can know the address
 * before the contract is deployed, which lets the merchant capture it
 * at onboarding and we deploy lazily on first payment.
 */

import { deriveWalletAddress as upstreamDerive } from '@passkey-ui/core'

import { NETWORK_PASSPHRASE, type StellarNetwork } from './network.js'

export interface DeriveMerchantWalletInput {
  /**
   * The passkey credential id minted by the merchant's device. The
   * upstream `deriveWalletAddress` hashes this as the deployment salt.
   */
  credentialId: Uint8Array
  /**
   * Account that will deploy the wallet contract. For Strimz this is
   * the operator account (`STELLAR_DEPLOYER_ADDRESS`) — funded by us,
   * one per network. Can be either a classic G-account or a C-contract;
   * we use the operator G-account.
   */
  deployer: string
  /** Network the wallet will live on. Drives the passphrase. */
  network: StellarNetwork
}

/**
 * Returns the deterministic Soroban contract address (C…) the
 * merchant's smart wallet will deploy to. Cheap, pure function — no
 * network I/O.
 */
export function deriveMerchantWalletAddress(input: DeriveMerchantWalletInput): string {
  return upstreamDerive({
    deployer: input.deployer,
    keyId: input.credentialId,
    networkPassphrase: NETWORK_PASSPHRASE[input.network],
  })
}
