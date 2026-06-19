/**
 * Stellar address validation + canonicalisation.
 *
 * Strimz accepts both Strkey shapes a merchant's payout address can
 * take:
 *
 *   - `G…` (56 chars) — a classic Ed25519 account. Used when the
 *     merchant brings their own existing Stellar wallet to onboarding.
 *   - `C…` (56 chars) — a Soroban contract address. Used when the
 *     merchant goes through the Strimz passkey-secured smart-wallet
 *     flow (the C-address is captured at onboarding by
 *     `@strimz/stellar-passkey/deriveMerchantWalletAddress`).
 *
 * Other Strkey shapes (`M…` muxed, `T…` pre-auth tx, `X…` shared
 * secret, `S…` seed) are intentionally rejected — none make sense as
 * a payout destination, and `S…` in particular is a SECRET that should
 * never be entered into a payout field.
 *
 * Backed by `@stellar/stellar-sdk`'s StrKey — checksums + version
 * bytes are validated by the SDK, so a typo'd address fails this check
 * rather than producing a misdirected payment later.
 */

import { StrKey } from '@stellar/stellar-sdk'

/**
 * True when `value` is a Strimz-acceptable Stellar payout address.
 * Stateless; no network I/O.
 */
export function isValidStellarPayoutAddress(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value)
}

/**
 * Returns the canonical Strkey form. Stellar Strkeys are already
 * upper-case-and-checksum-canonical, so this is essentially identity
 * for valid input — but it throws on invalid input, which the adapter
 * surfaces as a `chain_adapter` error.
 */
export function normaliseStellarAddress(value: string): string {
  if (!isValidStellarPayoutAddress(value)) {
    throw new Error(`"${value}" is not a valid Stellar G-account or C-contract`)
  }
  return value
}
