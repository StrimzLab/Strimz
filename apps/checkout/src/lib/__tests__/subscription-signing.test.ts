import { subscriptionIntentNonce } from '@strimz/shared-crypto/checkout'
import { describe, expect, it } from 'vitest'

import { subscriptionSigningRequest } from '../subscription-signing'

const PAYER = '0x5555555555555555555555555555555555555555'
const SUBSCRIPTIONS = '0x2222222222222222222222222222222222222222'
const UINT256_MAX = (1n << 256n) - 1n

function request() {
  return subscriptionSigningRequest({
    chainId: 5042002,
    subscriptionsAddress: SUBSCRIPTIONS,
    token: { address: '0x3600000000000000000000000000000000000000', name: 'USDC', version: '2' },
    payer: PAYER,
    planId: 'cmplan0000000000000001',
    merchantId: 7n,
    amount: 10_000_000n,
    interval: 2_592_000,
    startAt: 0n,
    endAt: 0n,
    permitValue: UINT256_MAX,
    permitNonce: 3n,
    deadline: 1_900_000_000n,
  })
}

describe('subscriptionSigningRequest', () => {
  it('binds the same permit value into the permit, the intent and the relay body', () => {
    const req = request()
    const body = req.body(`0x${'aa'.repeat(65)}`, `0x${'bb'.repeat(65)}`)

    expect(req.permit.message.value).toBe(UINT256_MAX)
    expect(req.intent.message.permitValue).toBe(UINT256_MAX)
    expect(body.permitData.value).toBe(UINT256_MAX.toString())
  })

  it("derives the intent nonce from the plan, the payer and the token's permit nonce", () => {
    const req = request()
    const nonce = subscriptionIntentNonce('cmplan0000000000000001', PAYER, 3n)

    expect(req.intent.message.nonce).toBe(nonce)
    expect(req.body('0x01', '0x02').nonce).toBe(nonce)
  })

  it('sends the wallet signatures as they came, including a smart-wallet signature', () => {
    const smartWalletSig = `0x${'cd'.repeat(300)}` as const
    const body = request().body(`0x${'aa'.repeat(65)}`, smartWalletSig)

    expect(body.permitSignature).toBe(`0x${'aa'.repeat(65)}`)
    expect(body.intentSignature).toBe(smartWalletSig)
  })
})
