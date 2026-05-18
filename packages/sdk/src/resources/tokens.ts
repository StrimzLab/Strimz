import {
  tokenMetadataSchema,
  tokenPermitNonceSchema,
  type TokenMetadata,
  type TokenPermitNonce,
} from '@strimz/shared-types'
import { BaseResource } from './base-resource.js'

/**
 * Token metadata + capability lookup.
 *
 * The two endpoints are public on the API (no key required) — token
 * metadata is purely chain-derived, has no PII, and is what the
 * browser SDK consults to pick which meta-tx path to take for a
 * given token. Bundled here so consumers don't have to write the HTTP
 * fetch themselves.
 */
export class TokensResource extends BaseResource {
  /**
   * Fetch full metadata for a token. Throws via the underlying fetcher
   * (404 → `StrimzNotFoundError`) if the token isn't whitelisted.
   */
  retrieve(address: string): Promise<TokenMetadata> {
    return this.get(
      `/v1/tokens/${encodeURIComponent(address.toLowerCase())}`,
      tokenMetadataSchema,
    )
  }

  /**
   * Read an owner's current EIP-2612 permit nonce. Call this
   * immediately before signing a Permit — the token contract rejects
   * stale nonces, and the value advances on every successful permit.
   */
  permitNonce(address: string, owner: string): Promise<TokenPermitNonce> {
    return this.get(
      `/v1/tokens/${encodeURIComponent(address.toLowerCase())}/permit-nonce`,
      tokenPermitNonceSchema,
      { owner: owner.toLowerCase() },
    )
  }
}

/**
 * Path selector — decides which meta-tx flow to take given a token's
 * capabilities and the action a merchant wants to perform.
 *
 * The choice is unambiguous in 99% of cases:
 *  - One-shot pay        → EIP-3009 (preferred). Falls back to
 *                          approve+pay if the token has neither.
 *  - Subscription enrol  → EIP-2612 (the only meta-tx path that
 *                          grants the recurring allowance subscribers
 *                          need). If unavailable, the merchant must
 *                          use the classic approve+create flow.
 *
 * Returned `path` values are strings (not enums) so future schemes
 * can extend the union without breaking existing call sites.
 */
export type RelayPath =
  | 'pay_with_authorization'
  | 'permit_and_create_subscription'
  | 'approve_then_pay'
  | 'approve_then_create_subscription'

export function selectPaymentPath(meta: TokenMetadata): RelayPath {
  return meta.capabilities.transferAuth3009 ? 'pay_with_authorization' : 'approve_then_pay'
}

export function selectSubscriptionPath(meta: TokenMetadata): RelayPath {
  return meta.capabilities.permit2612
    ? 'permit_and_create_subscription'
    : 'approve_then_create_subscription'
}
