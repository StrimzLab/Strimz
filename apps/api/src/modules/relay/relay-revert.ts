import {
  AbiErrorSignatureNotFoundError,
  BaseError,
  decodeErrorResult,
  ExecutionRevertedError,
  parseAbi,
  type Hex,
} from 'viem'

import { strimzErrorsAbi } from './generated/contracts.js'

// The token's permit and signature errors bubble up through the contracts.
export const relayRevertAbi = [
  ...strimzErrorsAbi,
  ...parseAbi([
    'error Error(string reason)',
    'error Panic(uint256 code)',
    'error ECDSAInvalidSignature()',
    'error ECDSAInvalidSignatureLength(uint256 length)',
    'error ECDSAInvalidSignatureS(bytes32 s)',
    'error ERC2612ExpiredSignature(uint256 deadline)',
    'error ERC2612InvalidSigner(address signer, address owner)',
  ]),
] as const

export function revertReasonOf(err: unknown): string | null {
  if (!(err instanceof BaseError)) return null
  if (!err.walk((e) => e instanceof ExecutionRevertedError)) return null
  const data = revertDataOf(err)
  if (!data || data === '0x') return 'unknown'
  return decodeRevert(data)
}

export function decodeRevert(data: Hex): string {
  try {
    const decoded = decodeErrorResult({ abi: relayRevertAbi, data })
    if (decoded.errorName === 'Error') return decoded.args[0]
    if (decoded.errorName === 'Panic') return `Panic(${decoded.args[0]})`
    return decoded.errorName
  } catch (err) {
    if (err instanceof AbiErrorSignatureNotFoundError) return data.slice(0, 10)
    throw err
  }
}

function revertDataOf(err: BaseError): Hex | undefined {
  const root = err.walk() as { data?: unknown }
  const data =
    typeof root.data === 'object' && root.data !== null
      ? (root.data as { data?: unknown }).data
      : root.data
  return typeof data === 'string' && data.startsWith('0x') ? (data as Hex) : undefined
}
