// Write ABI fragment for Circle's CCTP V2 `TokenMessengerV2`. Only
// `depositForBurn` — the single call the payer signs on the source
// chain. The mint side (`receiveMessage` on Arc) is signed by the
// scheduler and lives in apps/scheduler.

export const tokenMessengerV2Abi = [
  {
    type: 'function',
    name: 'depositForBurn',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' },
    ],
    outputs: [],
  },
] as const
