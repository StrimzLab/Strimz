import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, parseAbi } from 'viem'

import { RelayUnavailableError, submitCheckoutRelay } from '../checkout-submission'
import { checkedSelfPayCall, formatNetworkFee, selfPayErrorMessage } from '../self-pay'

const PAYMENTS = `0x${'a'.repeat(40)}` as const
const OTHER = `0x${'b'.repeat(40)}` as const
const CHAIN_ID = 5042002
const payAbi = parseAbi(['function payWithAuthorization(uint256 merchantId)'])
const cancelAbi = parseAbi(['function cancelWithSig(uint256 subscriptionId)'])
const PAY_DATA = encodeFunctionData({
  abi: payAbi,
  functionName: 'payWithAuthorization',
  args: [1n],
})

function refusal(call: unknown, reason = 'platform_paused') {
  return { error: { code: 'relay_unavailable', message: 'no', details: { reason, call } } }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('submitCheckoutRelay', () => {
  it('hands back the signed call when Strimz will not pay the gas', async () => {
    const call = { to: PAYMENTS, data: PAY_DATA, chainId: CHAIN_ID }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(refusal(call)), { status: 402 }))),
    )

    const err = await submitCheckoutRelay({ kind: 'sessions', id: 'ses_1' }, {}).catch(
      (e: unknown) => e,
    )

    expect(err).toBeInstanceOf(RelayUnavailableError)
    expect((err as RelayUnavailableError).call).toEqual(call)
    expect((err as RelayUnavailableError).reason).toBe('platform_paused')
  })

  it('treats a 402 without a usable call as an ordinary failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify(refusal({ to: 'nope' })), { status: 402 })),
      ),
    )

    const err = await submitCheckoutRelay({ kind: 'sessions', id: 'ses_1' }, {}).catch(
      (e: unknown) => e,
    )

    expect(err).not.toBeInstanceOf(RelayUnavailableError)
    expect(err).toBeInstanceOf(Error)
  })
})

describe('checkedSelfPayCall', () => {
  const expected = {
    to: PAYMENTS,
    chainId: CHAIN_ID,
    abi: payAbi,
    functionName: 'payWithAuthorization',
  }

  it('accepts the call this page expects', () => {
    const call = { to: PAYMENTS, data: PAY_DATA, chainId: CHAIN_ID }
    expect(checkedSelfPayCall(call, expected)).toEqual(call)
  })

  it('refuses a call to another contract', () => {
    expect(() =>
      checkedSelfPayCall({ to: OTHER, data: PAY_DATA, chainId: CHAIN_ID }, expected),
    ).toThrow()
  })

  it('refuses a call on another chain', () => {
    expect(() =>
      checkedSelfPayCall({ to: PAYMENTS, data: PAY_DATA, chainId: 1 }, expected),
    ).toThrow()
  })

  it('refuses a different function on the right contract', () => {
    const data = encodeFunctionData({ abi: cancelAbi, functionName: 'cancelWithSig', args: [1n] })
    expect(() => checkedSelfPayCall({ to: PAYMENTS, data, chainId: CHAIN_ID }, expected)).toThrow()
  })
})

describe('formatNetworkFee', () => {
  it('shows the fee in USDC, rounded up to a cent', () => {
    expect(formatNetworkFee(150_000n, 20_000_000_000n)).toBe('about 0.01 USDC')
    expect(formatNetworkFee(500_000n, 100_000_000_000n)).toBe('about 0.05 USDC')
  })
})

describe('selfPayErrorMessage', () => {
  it('tells a wallet that cannot send to try again later', () => {
    expect(selfPayErrorMessage(new Error('Method not supported: eth_sendTransaction'))).toMatch(
      /try again later/i,
    )
  })

  it('reports a cancel in the wallet plainly', () => {
    expect(selfPayErrorMessage(new Error('User rejected the request.'))).toMatch(/cancelled/i)
  })
})
