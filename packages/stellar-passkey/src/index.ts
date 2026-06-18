/**
 * @strimz/stellar-passkey — framework-free entry point.
 *
 * Owns the full passkey + smart-wallet-address-derivation stack:
 * native WebAuthn glue, capability detection, deterministic Soroban
 * contract-address derivation. No external SDK dependency beyond the
 * canonical `@stellar/stellar-sdk` (XDR + Strkey + hash). React
 * components live under the `/react` subpath export so server code
 * can import these without React.
 */

export { bytesToHex, fromBase64Url, toBase64Url } from './bytes.js'
export { detectCapabilities, isPasskeySupported, type BrowserCapabilities } from './capabilities.js'
export { deriveMerchantWalletAddress } from './derive.js'
export { NETWORK_PASSPHRASE, type StellarNetwork } from './network.js'
export type {
  CreatePasskeyResult,
  DeriveMerchantWalletInput,
  PasskeyEnrolError,
  PasskeyEnrolPhase,
} from './types.js'
export {
  createPasskey,
  signWithPasskey,
  type CreatePasskeyInput,
  type SignWithPasskeyInput,
  type SignWithPasskeyResult,
} from './webauthn.js'
