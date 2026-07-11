/**
 * Minimal ABI fragment for `StrimzRegistry.registerMerchant` and its
 * `MerchantRegistered` event. Inlined here to keep the merchants module
 * decoupled from the SDK's evolving surface.
 */
export const registerMerchantAbi = [
  {
    type: 'function',
    name: 'registerMerchant',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'payoutAddress', type: 'address' },
      { name: 'feeBps', type: 'uint16' },
      { name: 'parentMerchantId', type: 'uint256' },
    ],
    outputs: [{ name: 'merchantId', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'MerchantRegistered',
    inputs: [
      { name: 'merchantId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'payoutAddress', type: 'address', indexed: false },
      { name: 'feeBps', type: 'uint16', indexed: false },
      { name: 'maxFeeBps', type: 'uint16', indexed: false },
      { name: 'parentMerchantId', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const

/**
 * Read-only ABI for on-chain merchant state that the dashboard renders
 * (pending owner, pending payout address, payout-change timer, fee cap).
 * The dashboard never writes from the server; writes happen from the
 * merchant's own Privy embedded wallet.
 */
export const registryReadAbi = [
  {
    type: 'function',
    name: 'getMerchant',
    stateMutability: 'view',
    inputs: [{ name: 'merchantId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'feeBps', type: 'uint16' },
          { name: 'active', type: 'bool' },
          { name: 'payoutAddress', type: 'address' },
          { name: 'parentMerchantId', type: 'uint256' },
          { name: 'pendingOwner', type: 'address' },
          { name: 'pendingPayoutAddress', type: 'address' },
          { name: 'payoutChangeCommitAt', type: 'uint64' },
          { name: 'maxFeeBps', type: 'uint16' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'PAYOUT_CHANGE_DELAY',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint64' }],
  },
  // Registry custom errors so viem decodes reverts to a real name
  // instead of "unknown signature 0xc1e52643".
  {
    type: 'error',
    name: 'Registry__UnknownMerchant',
    inputs: [{ name: 'merchantId', type: 'uint256' }],
  },
  {
    type: 'error',
    name: 'Registry__MerchantInactive',
    inputs: [{ name: 'merchantId', type: 'uint256' }],
  },
  { type: 'error', name: 'Registry__ZeroAddress', inputs: [] },
] as const
