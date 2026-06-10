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
      { name: 'parentMerchantId', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
] as const
