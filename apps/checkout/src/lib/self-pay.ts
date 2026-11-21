import { isAddressEqual, toFunctionSelector, type Abi, type AbiFunction, type Hex } from 'viem'

import { RelayUnavailableError, type SelfPayCall } from '@/lib/checkout-submission'

export interface ExpectedCall {
  to: Hex
  chainId: number
  abi: Abi
  functionName: string
}

/** Arc pays gas in USDC, with 18 decimals. */
const GAS_DECIMALS = 18n
const CENT = 10n ** (GAS_DECIMALS - 2n)

const WALLET_REJECTION = /user (rejected|denied|cancel)|rejected the request|request rejected/iu

// The call comes from our API; check it anyway so a bad response can't point the payer's
// wallet at another contract, chain or function.
export function checkedSelfPayCall(call: SelfPayCall, expected: ExpectedCall): SelfPayCall {
  const fn = expected.abi.find(
    (item): item is AbiFunction => item.type === 'function' && item.name === expected.functionName,
  )
  if (!fn) throw new Error(`no ${expected.functionName} in the expected ABI`)
  if (!isAddressEqual(call.to, expected.to))
    throw new Error('the network fee call goes to an unexpected contract')
  if (call.chainId !== expected.chainId)
    throw new Error('the network fee call is for another network')
  if (!call.data.toLowerCase().startsWith(toFunctionSelector(fn).toLowerCase())) {
    throw new Error('the network fee call runs an unexpected function')
  }
  return call
}

/** What a flow does with an error: offer self-pay, fail with a reason, or neither (null). */
export function selfPayFallback(
  err: unknown,
  expected: ExpectedCall,
): { selfPayCall: SelfPayCall } | { error: string } | null {
  if (!(err instanceof RelayUnavailableError)) return null
  try {
    return { selfPayCall: checkedSelfPayCall(err.call, expected) }
  } catch (refused) {
    return { error: refused instanceof Error ? refused.message : 'unknown error' }
  }
}

export function formatNetworkFee(gas: bigint, gasPrice: bigint): string {
  const cents = (gas * gasPrice + CENT - 1n) / CENT
  const whole = cents / 100n
  const part = (cents % 100n).toString().padStart(2, '0')
  return `about ${whole}.${part} USDC`
}

export function selfPayErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : ''
  if (WALLET_REJECTION.test(raw)) return 'You cancelled in your wallet. Nothing was sent.'
  if (/insufficient funds/iu.test(raw)) {
    return "Your wallet doesn't hold enough USDC for the network fee. Add a little and try again."
  }
  return "Your wallet couldn't send this transaction. Nothing was charged; try again later."
}
