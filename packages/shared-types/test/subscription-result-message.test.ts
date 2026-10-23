import { describe, expect, it } from 'vitest'
import {
  createSubscriptionPlanInputSchema,
  subscriptionResultErrorCodes,
  subscriptionResultMessageSchema,
  updateSubscriptionPlanInputSchema,
} from '../src/index.js'

const txHash = `0x${'ab'.repeat(32)}`

describe('subscription result message', () => {
  it('accepts success with or without a subscription id, cancel and error', () => {
    expect(
      subscriptionResultMessageSchema.parse({
        type: 'strimz:subscription:success',
        planId: 'plan_1',
        subscriptionId: 'sub_1',
        txHash,
      }),
    ).toEqual({
      type: 'strimz:subscription:success',
      planId: 'plan_1',
      subscriptionId: 'sub_1',
      txHash,
    })
    expect(
      subscriptionResultMessageSchema.parse({
        type: 'strimz:subscription:success',
        planId: 'plan_1',
        subscriptionId: null,
        txHash,
      }),
    ).toMatchObject({ subscriptionId: null })
    expect(
      subscriptionResultMessageSchema.parse({
        type: 'strimz:subscription:cancel',
        planId: 'plan_1',
      }),
    ).toEqual({ type: 'strimz:subscription:cancel', planId: 'plan_1' })
    for (const code of subscriptionResultErrorCodes) {
      expect(
        subscriptionResultMessageSchema.parse({
          type: 'strimz:subscription:error',
          planId: 'plan_1',
          code,
          message: 'Something failed',
        }),
      ).toMatchObject({ code })
    }
  })

  it('has exactly the agreed error codes', () => {
    expect(subscriptionResultErrorCodes).toEqual([
      'load_failed',
      'merchant_not_ready',
      'payment_reverted',
      'already_subscribed',
    ])
  })

  it('rejects a payment checkout message and a success without a tx hash', () => {
    expect(
      subscriptionResultMessageSchema.safeParse({ type: 'strimz:checkout:cancel', sessionId: 's' })
        .success,
    ).toBe(false)
    expect(
      subscriptionResultMessageSchema.safeParse({
        type: 'strimz:subscription:success',
        planId: 'plan_1',
        subscriptionId: 'sub_1',
      }).success,
    ).toBe(false)
  })
})

describe('plan return URLs', () => {
  const plan = {
    name: 'Pro',
    amount: '10000000',
    currency: 'USDC',
    interval: 'monthly',
  } as const

  it('takes optional success and cancel URLs with placeholders on create', () => {
    const parsed = createSubscriptionPlanInputSchema.parse({
      ...plan,
      successUrl: 'https://app.example/welcome?sub={SUBSCRIPTION_ID}&tx={ON_CHAIN_TX_HASH}',
      cancelUrl: 'https://app.example/pricing',
    })
    expect(parsed.successUrl).toBe(
      'https://app.example/welcome?sub={SUBSCRIPTION_ID}&tx={ON_CHAIN_TX_HASH}',
    )
    expect(createSubscriptionPlanInputSchema.parse(plan).successUrl).toBeUndefined()
  })

  it('rejects a non-http URL', () => {
    expect(
      createSubscriptionPlanInputSchema.safeParse({ ...plan, successUrl: 'javascript:alert(1)' })
        .success,
    ).toBe(false)
  })

  it('updates only the return URLs, with null clearing one', () => {
    expect(updateSubscriptionPlanInputSchema.parse({ successUrl: null })).toEqual({
      successUrl: null,
    })
    expect(
      updateSubscriptionPlanInputSchema.safeParse({ successUrl: 'https://a.example', amount: '1' })
        .success,
    ).toBe(false)
    expect(updateSubscriptionPlanInputSchema.safeParse({}).success).toBe(false)
  })
})
