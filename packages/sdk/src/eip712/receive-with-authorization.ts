import type { Eip712TypedData } from './types.js'

/**
 * Inputs for the EIP-3009 ReceiveWithAuthorization typed-data.
 *
 *  - `chainId` is the EVM chain id (Arc Testnet = 5042002).
 *  - `token` is the ERC-20 contract whose `receiveWithAuthorization` is
 *    being invoked — usually USDC at `0x36...` on Arc.
 *  - `tokenName` and `tokenVersion` form the EIP-712 domain. Real USDC
 *    on most chains uses `name="USD Coin"` and `version="2"`; tests
 *    use whatever the mock token reports. Always read these from the
 *    token contract at runtime to avoid drift.
 *  - `from` is the payer; the wallet that produces the signature must
 *    match this address.
 *  - `to` is the recipient of the funds — for Strimz this is the
 *    StrimzPayments contract address (the contract pulls funds into
 *    itself, then forwards the fee + net split).
 *  - `value` is the gross amount in token base units.
 *  - `validAfter` / `validBefore` are unix-second timestamps bounding
 *    the signature's validity. Strimz's default checkout window is
 *    5 minutes; integrators may widen this for usage-based billing.
 *  - `nonce` is a single-use 32-byte value. Generate with crypto.randomBytes
 *    (server) or crypto.getRandomValues (browser). The token contract
 *    tracks `(authorizer, nonce) -> used` and rejects replays.
 */
export interface ReceiveWithAuthorizationParams {
  chainId: number
  token: `0x${string}`
  tokenName: string
  tokenVersion: string
  from: `0x${string}`
  to: `0x${string}`
  value: bigint
  validAfter: bigint
  validBefore: bigint
  nonce: `0x${string}`
}

/**
 * EIP-712 type definition for `ReceiveWithAuthorization`. Stable —
 * shared by every EIP-3009 implementation (USDC, EURC, etc.).
 *
 * Exported so consumers can introspect or extend with sibling
 * primitive types (e.g. for x402 batched signing schemes that wrap
 * multiple authorizations in one signature).
 */
export const RECEIVE_WITH_AUTHORIZATION_TYPES = {
  ReceiveWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

/**
 * Build the typed-data structure for an EIP-3009
 * `ReceiveWithAuthorization` signature. Returns the canonical shape
 * compatible with viem, ethers, Privy, and Reown.
 *
 * Pass the result to `walletClient.signTypedData(typedData)` (viem)
 * or `signer._signTypedData(domain, types, message)` (ethers) — the
 * SDK does not bind to a specific signer.
 */
export function buildReceiveWithAuthorizationTypedData(
  params: ReceiveWithAuthorizationParams,
): Eip712TypedData<'ReceiveWithAuthorization'> {
  return {
    domain: {
      name: params.tokenName,
      version: params.tokenVersion,
      chainId: params.chainId,
      verifyingContract: params.token,
    },
    types: RECEIVE_WITH_AUTHORIZATION_TYPES,
    primaryType: 'ReceiveWithAuthorization',
    message: {
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter,
      validBefore: params.validBefore,
      nonce: params.nonce,
    },
  }
}
