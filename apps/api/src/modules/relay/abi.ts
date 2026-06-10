/**
 * Minimal ABI fragments for the two entrypoints the relayer submits.
 *
 * Inlined here rather than imported from the SDK so the relay module
 * has zero coupling to the SDK's evolving public surface. The function
 * shapes are stable contract ABI — they don't change without a
 * coordinated contract redeploy.
 */
export const payWithAuthorizationAbi = [
  {
    type: 'function',
    name: 'payWithAuthorization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'merchantId', type: 'uint256' },
      { name: 'token', type: 'address' },
      {
        name: 'auth',
        type: 'tuple',
        components: [
          { name: 'from', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      { name: 'ref', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

export const permitAndCreateSubscriptionAbi = [
  {
    type: 'function',
    name: 'permitAndCreateSubscription',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'merchantId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interval', type: 'uint32' },
      { name: 'startAt', type: 'uint64' },
      { name: 'endAt', type: 'uint64' },
      {
        name: 'permitData',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [{ name: 'subscriptionId', type: 'uint256' }],
  },
] as const
