import { describe, expect, it } from 'vitest'
import {
  checkoutResultErrorCodes,
  checkoutResultMessageSchema,
  createPaymentSessionInputSchema,
} from '../src/index.js'

const txHash = `0x${'ab'.repeat(32)}`

describe('checkout result message', () => {
  it('accepts success, cancel and error', () => {
    expect(
      checkoutResultMessageSchema.parse({
        type: 'strimz:checkout:success',
        sessionId: 'sess_1',
        txHash,
      }),
    ).toEqual({ type: 'strimz:checkout:success', sessionId: 'sess_1', txHash })
    expect(
      checkoutResultMessageSchema.parse({ type: 'strimz:checkout:cancel', sessionId: 'sess_1' }),
    ).toEqual({ type: 'strimz:checkout:cancel', sessionId: 'sess_1' })
    for (const code of checkoutResultErrorCodes) {
      expect(
        checkoutResultMessageSchema.parse({
          type: 'strimz:checkout:error',
          sessionId: 'sess_1',
          code,
          message: 'Something failed',
        }),
      ).toMatchObject({ code })
    }
  })

  it('has exactly the agreed error codes', () => {
    expect(checkoutResultErrorCodes).toEqual([
      'load_failed',
      'merchant_not_ready',
      'payment_reverted',
      'unsupported_wallet',
    ])
  })

  it.each([
    ['an unknown type', { type: 'strimz:checkout:done', sessionId: 'sess_1' }],
    ['success without a tx hash', { type: 'strimz:checkout:success', sessionId: 'sess_1' }],
    [
      'success with a malformed tx hash',
      { type: 'strimz:checkout:success', sessionId: 'sess_1', txHash: '0x12' },
    ],
    ['cancel without a session', { type: 'strimz:checkout:cancel' }],
    [
      'an error with an unknown code',
      { type: 'strimz:checkout:error', sessionId: 'sess_1', code: 'boom', message: 'x' },
    ],
    ['a string', 'strimz:checkout:success'],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(checkoutResultMessageSchema.safeParse(value).success).toBe(false)
  })
})

describe('payment session callback URLs', () => {
  const base = { amount: '1000000', currency: 'USDC' }

  it('accepts placeholders in success and cancel URLs', () => {
    const parsed = createPaymentSessionInputSchema.parse({
      ...base,
      successUrl: 'https://shop.example/thanks?session={CHECKOUT_SESSION_ID}&tx={ON_CHAIN_TX_HASH}',
      cancelUrl: 'https://shop.example/cart?session={CHECKOUT_SESSION_ID}',
    })
    expect(parsed.successUrl).toBe(
      'https://shop.example/thanks?session={CHECKOUT_SESSION_ID}&tx={ON_CHAIN_TX_HASH}',
    )
    expect(parsed.cancelUrl).toBe('https://shop.example/cart?session={CHECKOUT_SESSION_ID}')
  })

  it.each(['successUrl', 'cancelUrl'])('rejects a non-http %s', (field) => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd']) {
      expect(createPaymentSessionInputSchema.safeParse({ ...base, [field]: url }).success).toBe(
        false,
      )
    }
  })
})
