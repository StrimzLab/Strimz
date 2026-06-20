/**
 * Native-value → ScVal converters for the Strimz Soroban contracts.
 *
 * Strimz's M4 contracts take a fixed set of argument types — `Address`,
 * `i128`, `u32`, `u64`, `Option<u64>`, `BytesN<32>`. Centralising the
 * conversion keeps the builders short and the call-site fingerprints
 * stable. If a contract gains a new argument shape, the change happens
 * here once.
 */

import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk'
import { createHash } from 'node:crypto'

/**
 * Encodes a Stellar address (G… classic account or C… contract) as a
 * Soroban `Address` ScVal. Throws if the input isn't valid Strkey;
 * callers should `validateAddress` first.
 */
export function addressToScVal(value: string): xdr.ScVal {
  return Address.fromString(value).toScVal()
}

/**
 * Encodes an `i128` from a base-10 string. The contracts use this for
 * token amounts so callers can stay BigInt-safe across the wire.
 */
export function i128ToScVal(amount: string): xdr.ScVal {
  return nativeToScVal(BigInt(amount), { type: 'i128' })
}

/** Encodes a `u32`. */
export function u32ToScVal(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: 'u32' })
}

/** Encodes a `u64`. */
export function u64ToScVal(value: number): xdr.ScVal {
  return nativeToScVal(BigInt(value), { type: 'u64' })
}

/**
 * Encodes an `Option<u64>` — `None` when the value is null, otherwise
 * `Some(value)`. Used for the subscription's `end_at` field.
 */
export function optionalU64ToScVal(value: number | null): xdr.ScVal {
  if (value === null) return xdr.ScVal.scvVoid()
  return u64ToScVal(value)
}

/**
 * Encodes a `BytesN<32>` from a 32-byte buffer. Throws if the buffer
 * isn't exactly 32 bytes — Soroban's BytesN is fixed-length.
 */
export function bytesN32ToScVal(value: Uint8Array | Buffer): xdr.ScVal {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value)
  if (buf.length !== 32) {
    throw new Error(`BytesN<32> requires exactly 32 bytes, got ${buf.length}`)
  }
  return xdr.ScVal.scvBytes(buf)
}

/**
 * Derives a stable 32-byte identifier from a free-form string. The
 * Strimz `ref` field on a payment session is a CUID; we SHA-256 it so
 * the contract gets a fixed-length BytesN<32> regardless of input
 * length, and `ref → refId` is deterministic + collision-resistant.
 *
 * Same scheme is used for subscription `attempt_id` in M5c.
 */
export function refToBytesN32(ref: string): Buffer {
  return createHash('sha256').update(ref, 'utf8').digest()
}
