import { describe, expect, it } from 'vitest'

import {
  submitPaymentInputSchema,
  submitSubscriptionInputSchema,
} from '../../../../src/modules/relay/relay.dto.js'

const r = `0x${'ab'.repeat(32)}`
const s = `0x${'cd'.repeat(32)}`
const hex32 = `0x${'11'.repeat(32)}`
const addr = `0x${'22'.repeat(20)}`

function payment(authSignature: unknown) {
  return {
    merchantId: '1',
    token: addr,
    auth: { from: addr, amount: '1', validAfter: '0', validBefore: '9', nonce: hex32 },
    ref: hex32,
    authSignature,
    intentSignature: `0x${'ee'.repeat(65)}`,
    sessionId: 'ses_1',
  }
}

describe('relay DTO signatures', () => {
  it('packs a {v, r, s} object as r ‖ s ‖ v', () => {
    const out = submitPaymentInputSchema.parse(payment({ v: 28, r, s }))
    expect(out.authSignature).toBe(`${r}${s.slice(2)}1c`)
  })

  it('passes a smart-wallet signature of any length through as hex', () => {
    const sig = `0x${'0f'.repeat(300)}`
    expect(submitPaymentInputSchema.parse(payment(sig)).authSignature).toBe(sig)
  })

  it('rejects a signature over 4,096 bytes, odd-length hex and a bad v', () => {
    expect(submitPaymentInputSchema.safeParse(payment(`0x${'00'.repeat(4097)}`)).success).toBe(
      false,
    )
    expect(submitPaymentInputSchema.safeParse(payment('0xabc')).success).toBe(false)
    expect(submitPaymentInputSchema.safeParse(payment({ v: 29, r, s })).success).toBe(false)
  })

  it('requires the subscription intent nonce', () => {
    const body = {
      merchantId: '1',
      token: addr,
      amount: '1',
      interval: 60,
      startAt: '0',
      endAt: '0',
      permitData: { owner: addr, value: '1', deadline: '9' },
      permitSignature: { v: 27, r, s },
      intentSignature: { v: 27, r, s },
      subscriptionInternalId: 'plan_1',
    }
    expect(submitSubscriptionInputSchema.safeParse(body).success).toBe(false)
    expect(submitSubscriptionInputSchema.parse({ ...body, nonce: hex32 }).nonce).toBe(hex32)
  })
})
