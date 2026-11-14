// Write ABI fragment for StrimzRegistry. Only the functions the
// merchant Settings page calls from the payer's own Privy wallet.
// The API never signs these; they're always from the merchant's key.

export const registryWriteAbi = [
  {
    type: 'function',
    name: 'setPayoutAddress',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'merchantId', type: 'uint256' },
      { name: 'newPayoutAddress', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'commitPayoutAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'merchantId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelPayoutAddressChange',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'merchantId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'transferMerchantOwnership',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'merchantId', type: 'uint256' },
      { name: 'newOwner', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'acceptMerchantOwnership',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'merchantId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelOwnershipTransfer',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'merchantId', type: 'uint256' }],
    outputs: [],
  },
] as const
