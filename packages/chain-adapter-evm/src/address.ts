/**
 * EVM address validation + canonicalisation. Thin wrapper over viem's
 * `isAddress` + `getAddress` so the call-site doesn't need a viem
 * import every time it has a string to check.
 *
 * Stays a pure function module — no class state, no I/O.
 */

import { getAddress, isAddress } from 'viem'

/**
 * True when `value` is a syntactically valid EVM address. Doesn't
 * touch the network; accepts mixed case + checksummed forms.
 */
export function isValidEvmAddress(value: string): boolean {
  return isAddress(value)
}

/**
 * Returns the EIP-55 checksummed form. Throws on invalid input —
 * callers should `isValidEvmAddress` first, or catch and rethrow as
 * `InvalidAddressError` at the adapter boundary.
 */
export function checksumEvmAddress(value: string): `0x${string}` {
  return getAddress(value)
}
