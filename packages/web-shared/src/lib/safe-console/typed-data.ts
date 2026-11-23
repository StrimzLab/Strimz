import { getAddress, hashTypedData, zeroAddress, type Address, type Hex } from 'viem'

export interface SafeTxFields {
  to: Address
  data: Hex
  nonce: number
}

// Every gas field is zero: the relayer pays and the Safe refunds nobody.
export function safeTxTypedData(chainId: number, safe: Address, tx: SafeTxFields) {
  return {
    domain: { chainId, verifyingContract: getAddress(safe) },
    types: {
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
    },
    primaryType: 'SafeTx' as const,
    message: {
      to: getAddress(tx.to),
      value: 0n,
      data: tx.data,
      operation: 0,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
      nonce: BigInt(tx.nonce),
    },
  }
}

export const safeTxHashOf = (chainId: number, safe: Address, tx: SafeTxFields): Hex =>
  hashTypedData(safeTxTypedData(chainId, safe, tx))

// eth_signTypedData_v4 takes JSON, which has no bigint.
export function typedDataJson(data: ReturnType<typeof safeTxTypedData>): string {
  return JSON.stringify(
    {
      ...data,
      types: {
        EIP712Domain: [
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        ...data.types,
      },
    },
    (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v),
  )
}
