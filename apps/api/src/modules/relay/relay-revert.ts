import {
  AbiErrorSignatureNotFoundError,
  BaseError,
  decodeErrorResult,
  ExecutionRevertedError,
  parseAbi,
  type Hex,
} from 'viem'

export const relayRevertAbi = parseAbi([
  'error Error(string reason)',
  'error Panic(uint256 code)',
  'error Payments__InvalidToken(address token)',
  'error Payments__InvalidAmount()',
  'error Payments__MerchantInactive(uint256 merchantId)',
  'error Payments__TransferFailed()',
  'error Payments__UnsupportedCapability(address token)',
  'error Payments__InvalidIntent()',
  'error Payments__NonStandardTransfer()',
  'error Subscriptions__InvalidToken(address token)',
  'error Subscriptions__InvalidInterval()',
  'error Subscriptions__InvalidAmount()',
  'error Subscriptions__InvalidMerchantId()',
  'error Subscriptions__InvalidEndAt()',
  'error Subscriptions__InvalidStartAt()',
  'error Subscriptions__UnsupportedCapability(address token)',
  'error Subscriptions__InvalidIntent()',
  'error Subscriptions__NonStandardTransfer()',
  'error Registry__UnknownMerchant(uint256 merchantId)',
  'error Registry__MerchantInactive(uint256 merchantId)',
  'error TokenWhitelist__NotWhitelisted(address token)',
  'error EnforcedPause()',
  'error ReentrancyGuardReentrantCall()',
  'error ECDSAInvalidSignature()',
  'error ECDSAInvalidSignatureLength(uint256 length)',
  'error ECDSAInvalidSignatureS(bytes32 s)',
  'error ERC2612ExpiredSignature(uint256 deadline)',
  'error ERC2612InvalidSigner(address signer, address owner)',
])

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
