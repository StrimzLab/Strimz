import type { Eip712TypedData } from './types.js'

/**
 * Inputs for the EIP-2612 Permit typed-data.
 *
 *  - `chainId`, `token`, `tokenName`, `tokenVersion` form the EIP-712
 *    domain (same shape as the EIP-3009 builder).
 *  - `owner` is the token holder authorising the allowance. Must match
 *    the signing wallet.
 *  - `spender` is the contract that will pull funds. For Strimz
 *    subscriptions this is the StrimzSubscriptions contract.
 *  - `value` is the allowance to grant in token base units.
 *    `type(uint256).max` produces an unlimited allowance and is the
 *    common case for subscription enrolment.
 *  - `nonce` is the owner's *current* `nonces(owner)` reading from the
 *    token contract. The SDK does not fetch this. The caller is
 *    expected to have just queried it. Race-free: the token rejects
 *    stale nonces, so a concurrent permit on the same owner causes one
 *    to fail predictably.
 *  - `deadline` is the unix-second timestamp after which the permit
 *    expires. Strimz default for subscription enrolment is 24h. Enough
 *    headroom for a slow merchant submit pipeline without leaving an
 *    indefinite signature window.
 */
export interface PermitParams {
  chainId: number
  token: `0x${string}`
  tokenName: string
  tokenVersion: string
  owner: `0x${string}`
  spender: `0x${string}`
  value: bigint
  nonce: bigint
  deadline: bigint
}

/**
 * EIP-712 type definition for `Permit`. Stable across every EIP-2612
 * implementation (USDC, EURC, DAI v2, etc.).
 */
export const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

/**
 * Build the typed-data structure for an EIP-2612 `Permit` signature.
 * Returns the canonical shape compatible with viem, ethers, Privy,
 * and Reown.
 */
export function buildPermitTypedData(params: PermitParams): Eip712TypedData<'Permit'> {
  return {
    domain: {
      name: params.tokenName,
      version: params.tokenVersion,
      chainId: params.chainId,
      verifyingContract: params.token,
    },
    types: PERMIT_TYPES,
    primaryType: 'Permit',
    message: {
      owner: params.owner,
      spender: params.spender,
      value: params.value,
      nonce: params.nonce,
      deadline: params.deadline,
    },
  }
}
