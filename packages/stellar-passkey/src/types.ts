/**
 * Shared types for the passkey + smart-wallet flow.
 *
 * Kept framework-free so the API server (which only needs to
 * understand the serialised form) can import these alongside the
 * browser code without pulling in React.
 */

import type { StellarNetwork } from './network.js'

/**
 * Successful create-passkey result. Includes both the
 * device-specific credential id (used as the smart-wallet salt) and
 * the SPKI-encoded public key (needed by the Soroban contract's
 * secp256r1 verifier when the wallet is eventually deployed).
 *
 * `publicKey` is nullable because `getPublicKey()` returns null on
 * older browsers + authenticators. M3 captures it when available; M5
 * re-derives if missing.
 */
export interface CreatePasskeyResult {
  /** Device-bound credential id from the authenticator. */
  credentialId: Uint8Array
  /** Base64url-encoded form — what we persist. */
  credentialIdBase64Url: string
  /** SPKI-formatted public key bytes, when the browser exposes them. */
  publicKey: Uint8Array | null
  /** COSE algorithm id (e.g. -7 for ES256), when known. */
  publicKeyAlgorithm: number | null
}

/** Input shape for the wallet-address derivation. */
export interface DeriveMerchantWalletInput {
  /**
   * Passkey credential id minted by the merchant's device. The salt
   * for the Soroban contract address is `SHA-256(credentialId)`, so a
   * passkey is durably bound to one wallet contract address.
   */
  credentialId: Uint8Array
  /**
   * Account that will deploy the wallet contract — for Strimz this is
   * the operator G-account, funded by Strimz so the merchant doesn't
   * pay an account-creation reserve.
   */
  deployer: string
  /** Network the wallet will live on (drives the passphrase). */
  network: StellarNetwork
}

/**
 * Sub-state of the React `<MerchantPasskeyEnrol />` flow. Surfaces a
 * small state machine the consumer renders against; the component
 * uses these to decide what UI to show.
 */
export type PasskeyEnrolPhase = 'idle' | 'checking' | 'prompting' | 'success' | 'error'

/** Reason a flow ended without a credential. */
export interface PasskeyEnrolError {
  /** Stable machine code: `unsupported` / `user_cancelled` / `unknown`. */
  code: 'unsupported' | 'user_cancelled' | 'unknown'
  /** Human-readable detail surfaced in the UI. */
  message: string
}
