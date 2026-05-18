/**
 * Minimal ABI fragments the TokensService calls.
 *
 * Three groupings:
 *  - Standard ERC-20 metadata (name, symbol, decimals)
 *  - EIP-2612 nonces(owner)
 *  - ERC-5267 eip712Domain() — used to read the EIP-712 domain
 *    name+version from the token itself rather than hardcoding it.
 *    OZ's ERC20Permit ships ERC-5267 in v5+; older tokens that don't
 *    implement it surface as a revert, which the service catches and
 *    falls back from.
 *  - Strimz TokenWhitelist supportsCapability / getCapabilities
 */

export const erc20MetadataAbi = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const

export const eip2612NoncesAbi = [
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

export const erc5267Eip712DomainAbi = [
  {
    type: 'function',
    name: 'eip712Domain',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'fields', type: 'bytes1' },
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
      { name: 'salt', type: 'bytes32' },
      { name: 'extensions', type: 'uint256[]' },
    ],
  },
] as const

export const tokenWhitelistAbi = [
  {
    type: 'function',
    name: 'isWhitelisted',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getCapabilities',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'supportsCapability',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'capability', type: 'uint8' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

/** Capability bits mirroring TokenWhitelist constants. */
export const CAP_PERMIT_2612 = 0x01
export const CAP_TRANSFER_AUTH_3009 = 0x02
