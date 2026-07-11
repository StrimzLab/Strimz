/**
 * Function ABIs the scheduler signs against. Hand-curated from the
 * Solidity interface declarations — only includes what we *call* (write
 * methods); read paths use the indexer.
 *
 * Source-of-truth: `packages/contracts/src/interfaces/*.sol`. If a
 * signature drifts, the contract's chain-side revert message is the first
 * thing we'd see in failed-tx logs.
 */

export const StrimzSubscriptionsAbi = [
  {
    type: 'function',
    name: 'cancel',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'batchCharge',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'subscriptionIds', type: 'uint256[]' },
      { name: 'chargeAttemptIds', type: 'bytes32[]' },
    ],
    outputs: [{ name: 'outcomes', type: 'uint8[]' }],
  },
  {
    type: 'function',
    name: 'isAttemptUsed',
    stateMutability: 'view',
    inputs: [{ name: 'chargeAttemptId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getSubscription',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'payer', type: 'address' },
          { name: 'nextChargeAt', type: 'uint64' },
          { name: 'interval', type: 'uint32' },
          { name: 'token', type: 'address' },
          { name: 'merchantId', type: 'uint96' },
          { name: 'amount', type: 'uint256' },
          { name: 'endAt', type: 'uint64' },
          { name: 'cancelled', type: 'bool' },
        ],
      },
    ],
  },
] as const

export const StrimzAgentEscrowAbi = [
  {
    type: 'function',
    name: 'createJob',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vendor', type: 'address' },
      { name: 'assessor', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'description', type: 'string' },
    ],
    outputs: [{ name: 'jobId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'fundJob',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'startJob',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitDeliverable',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'deliverableHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approveAndRelease',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'dispute',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelJob',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'jobId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
] as const

/**
 * Circle CCTP V2 `MessageTransmitter` — only `receiveMessage` is
 * exposed because that's the single function the scheduler signs.
 * Burn-side calls happen on the source chain (and aren't signed by us).
 *
 * Reference: https://developers.circle.com/stablecoins/cctp-getting-started
 */
export const MessageTransmitterAbi = [
  {
    type: 'function',
    name: 'receiveMessage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
] as const
