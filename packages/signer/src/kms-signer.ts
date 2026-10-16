/**
 * Abstraction over a hardware-backed signing key.
 *
 * The interface signs a 32-byte digest. It does NOT know about
 * transactions, EIP-191 messages, or EIP-712 typed-data — those are
 * built by the caller (typically via the viem helpers in `kms-account.ts`)
 * and reduced to a digest before being passed here. This keeps the KMS
 * surface minimal and uniform across AWS KMS, GCP KMS, Vault Transit,
 * and the local-dev fallback.
 *
 * The returned signature is the canonical 65-byte Ethereum form:
 *   r (32) || s (32) || v (1)
 * where v is 27 or 28. This is the same shape `secp256k1.sign(...)`
 * produces and is what viem's `signatureToHex` / `recoverAddress`
 * accept directly.
 */
export interface KmsSigner {
  /** Ethereum address derived from the signing public key. */
  readonly address: `0x${string}`

  /**
   * Sign a pre-computed 32-byte digest.
   *
   * Implementations MUST:
   *  - normalise `s` to the lower half of the curve order (BIP-62 / EIP-2);
   *  - select `v` such that `ecrecover(digest, v, r, s) == this.address`;
   *  - return a 65-byte signature serialised as `0x<r><s><v>` hex.
   */
  signDigest(digest: `0x${string}`): Promise<`0x${string}`>
}
