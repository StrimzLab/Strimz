/**
 * Token metadata + capability descriptor.
 *
 * Read by the SDK's BrowserClient to (1) pick the right meta-tx path
 * for a given token and (2) build the EIP-712 typed-data domain. The
 * shape is intentionally derived from on-chain reads — name / version
 * from the token's ERC-5267 `eip712Domain()` (falling back to a
 * default), capabilities from Strimz's TokenWhitelist contract.
 *
 * `capabilities.permit2612` means the token implements EIP-2612 (the
 * gasless allowance + subscription enrolment path).
 * `capabilities.transferAuth3009` means the token implements EIP-3009
 * (the gasless one-shot payment path).
 *
 * Tokens may have one capability or both — USDC and EURC on Arc
 * advertise both.
 */

import { z } from 'zod'

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/u, 'must be a 0x-prefixed 20-byte address')

export const tokenCapabilitiesSchema = z.object({
  permit2612: z.boolean(),
  transferAuth3009: z.boolean(),
})
export type TokenCapabilities = z.infer<typeof tokenCapabilitiesSchema>

export const tokenMetadataSchema = z.object({
  address: addressSchema,
  name: z.string(),
  symbol: z.string(),
  /**
   * EIP-712 domain version. Read from ERC-5267 `eip712Domain()` when
   * available; otherwise defaults to "1". Used by typed-data builders
   * — domain mismatch produces a different digest and the contract's
   * ecrecover would recover a different address.
   */
  version: z.string(),
  decimals: z.number().int().min(0).max(255),
  capabilities: tokenCapabilitiesSchema,
})
export type TokenMetadata = z.infer<typeof tokenMetadataSchema>

/**
 * Owner-specific permit nonce. The EIP-2612 standard tracks a per-
 * owner monotonic counter — every successful permit consumes one,
 * so signers must read the current value immediately before signing.
 *
 * Returned as a decimal string to avoid JS number truncation on the
 * uint256 values some long-lived owners can accumulate.
 */
export const tokenPermitNonceSchema = z.object({
  token: addressSchema,
  owner: addressSchema,
  nonce: z.string().regex(/^[0-9]+$/u, 'must be a decimal integer string'),
})
export type TokenPermitNonce = z.infer<typeof tokenPermitNonceSchema>
