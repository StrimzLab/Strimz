import { describe, expect, it } from 'vitest'
import type { SubscriptionPlan } from '@strimz/shared-types'
import { buildProductInput, type ProductFormState } from '../storefront-product-input'

const plan: SubscriptionPlan = {
  id: 'plan_1',
  merchantId: 'm_1',
  chainMerchantId: null,
  tokenAddress: null,
  intervalSeconds: 2_592_000,
  name: 'Pro',
  description: null,
  amount: '20000000',
  currency: 'EURC',
  interval: 'monthly',
  intervalCount: 1,
  trialPeriodDays: null,
  status: 'active',
  metadata: {},
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
}

const base: ProductFormState = {
  name: 'Widget',
  description: '',
  imageUrl: null,
  price: '99',
  type: 'one_time',
  stock: '',
  plan: null,
}

describe('buildProductInput', () => {
  it('sends a one-time product without a plan', () => {
    const result = buildProductInput(base)
    expect(result).toMatchObject({
      ok: true,
      input: { price: '99000000', currency: 'USDC', type: 'one_time', interval: null, stock: null },
    })
    expect(result.ok && 'planId' in result.input).toBe(false)
  })

  it('refuses a subscription product until a plan is chosen', () => {
    expect(buildProductInput({ ...base, type: 'subscription' })).toEqual({
      ok: false,
      reason: 'incomplete',
    })
  })

  it('takes price, currency and interval from the chosen plan', () => {
    const result = buildProductInput({ ...base, type: 'subscription', price: '1', plan })
    expect(result).toEqual({
      ok: true,
      input: {
        name: 'Widget',
        description: null,
        price: '20000000',
        currency: 'EURC',
        type: 'subscription',
        interval: 'monthly',
        intervalCount: 1,
        planId: 'plan_1',
        stock: null,
        isActive: true,
        sortOrder: 0,
      },
    })
  })

  it('rejects an unparseable price', () => {
    expect(buildProductInput({ ...base, price: 'abc' })).toEqual({
      ok: false,
      reason: 'invalid_price',
    })
  })
})
