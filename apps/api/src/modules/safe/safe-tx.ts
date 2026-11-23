import {
  getAddress,
  hashTypedData,
  recoverTypedDataAddress,
  size,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'

export interface SafeTx {
  to: Address
  value: bigint
  data: Hex
  operation: 0
  nonce: bigint
}

const SAFE_TX_TYPES = {
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const

// All gas fields are zero: the relayer pays and the Safe refunds nobody (ADR-2026-11-23-safe-console).
export function safeTypedData(chainId: number, safe: Address, tx: SafeTx) {
  return {
    domain: { chainId, verifyingContract: getAddress(safe) },
    types: SAFE_TX_TYPES,
    primaryType: 'SafeTx' as const,
    message: {
      to: getAddress(tx.to),
      value: tx.value,
      data: tx.data,
      operation: tx.operation,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
      nonce: tx.nonce,
    },
  }
}

export function safeTxHash(chainId: number, safe: Address, tx: SafeTx): Hex {
  return hashTypedData(safeTypedData(chainId, safe, tx))
}

export async function recoverSafeSigner(
  chainId: number,
  safe: Address,
  tx: SafeTx,
  signature: Hex,
): Promise<Address> {
  const normalized = normalizeSafeSignature(signature)
  const signer = await recoverTypedDataAddress({
    ...safeTypedData(chainId, safe, tx),
    signature: normalized,
  })
  return signer
}

// Some hardware wallets return v as 0 or 1; to a Safe those mean contract and pre-approved
// signatures, so they become 27 or 28. Anything else, like eth_sign's v above 30, is refused.
export function normalizeSafeSignature(signature: Hex): Hex {
  if (size(signature) !== 65) throw new Error('a Safe signature must be 65 bytes')
  const v = parseInt(signature.slice(130), 16)
  const fixed = v < 2 ? v + 27 : v
  if (fixed !== 27 && fixed !== 28) {
    throw new Error('only typed-data signatures with v 27 or 28 are accepted')
  }
  return `${signature.slice(0, 130)}${fixed.toString(16)}` as Hex
}

export function packSignatures(sigs: { signer: Address; signature: Hex }[]): Hex {
  const sorted = [...sigs].sort((x, y) => (BigInt(x.signer) < BigInt(y.signer) ? -1 : 1))
  return `0x${sorted.map((s) => s.signature.slice(2)).join('')}`
}
