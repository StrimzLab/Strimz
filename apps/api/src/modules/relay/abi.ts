/**
 * Contract ABIs for the two entrypoints the relayer submits.
 * Both take two signatures — token sig + Strimz intent sig.
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
      {
        name: 'authSig',
        type: 'tuple',
        components: [
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
      },
      {
        name: 'intentSig',
        type: 'tuple',
        components: [
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
      },
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
      {
        name: 'permitSig',
        type: 'tuple',
        components: [
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
      },
      {
        name: 'intentSig',
        type: 'tuple',
        components: [
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
      },
    ],
    outputs: [{ name: 'subscriptionId', type: 'uint256' }],
  },
] as const
