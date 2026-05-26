/**
 * Canonical EIP-712 typed-data shape.
 *
 * Matches the structure every major wallet library accepts:
 *   viem's `signTypedData`
 *   ethers' `signer._signTypedData`
 *   Privy's `signTypedData`
 *   Reown AppKit's typed-data RPC
 *
 * The SDK can produce typed-data without binding to a specific wallet
 * client. Consumers pipe the result into whichever signer they
 * already use.
 *
 * No viem/ethers dependency on purpose: the SDK stays minimal, and
 * apps can choose their own signing stack.
 */

export interface Eip712Domain {
  name?: string
  version?: string
  chainId?: number
  verifyingContract?: `0x${string}`
  salt?: `0x${string}`
}

export interface Eip712Field {
  name: string
  type: string
}

export type Eip712Types = Record<string, readonly Eip712Field[]>

/**
 * EIP-712 typed-data definition. `primaryType` names the struct that
 * gets hashed at the top level (the `types` object usually contains
 * additional referenced sub-structs).
 *
 * `bigint` is used for uint values. Wallet libs handle the conversion
 * to hex/decimal at signing time. If a consumer needs to JSON-serialise
 * this object, convert bigints to strings at that boundary.
 */
export interface Eip712TypedData<TPrimary extends string = string> {
  domain: Eip712Domain
  types: Eip712Types
  primaryType: TPrimary
  message: Record<string, unknown>
}
