import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  buildCancelSubscriptionTypedData,
  buildSubscriptionIntentTypedData,
  CANCEL_SUBSCRIPTION_TYPES,
  PAY_INTENT_TYPES,
  SUBSCRIPTION_INTENT_TYPES,
} from '../src/eip712/index.js'

function contractTypeString(file: string, name: string): string {
  const source = readFileSync(new URL(`../../contracts/src/core/${file}`, import.meta.url), 'utf8')
  const match = new RegExp(`"(${name}\\([^"]*\\))"`).exec(source)
  if (!match?.[1]) throw new Error(`no ${name} type string in ${file}`)
  return match[1]
}

function typeString(name: string, fields: readonly { name: string; type: string }[]) {
  return `${name}(${fields.map((f) => `${f.type} ${f.name}`).join(',')})`
}

describe('intent type strings', () => {
  it('PayIntent matches StrimzPayments', () => {
    expect(typeString('PayIntent', PAY_INTENT_TYPES.PayIntent)).toBe(
      contractTypeString('StrimzPayments.sol', 'PayIntent'),
    )
  })

  it('SubscriptionIntent matches StrimzSubscriptions', () => {
    expect(typeString('SubscriptionIntent', SUBSCRIPTION_INTENT_TYPES.SubscriptionIntent)).toBe(
      contractTypeString('StrimzSubscriptions.sol', 'SubscriptionIntent'),
    )
  })

  it('CancelSubscription matches StrimzSubscriptions', () => {
    expect(typeString('CancelSubscription', CANCEL_SUBSCRIPTION_TYPES.CancelSubscription)).toBe(
      contractTypeString('StrimzSubscriptions.sol', 'CancelSubscription'),
    )
  })

  it('signs the cancel on the subscriptions domain', () => {
    const typed = buildCancelSubscriptionTypedData({
      chainId: 5042002,
      verifyingContract: '0x0000000000000000000000000000000000000001',
      subscriptionId: 7n,
      deadline: 99n,
    })
    expect(typed.domain).toMatchObject({ name: 'StrimzSubscriptions', version: '1' })
    expect(typed.message).toEqual({ subscriptionId: 7n, deadline: 99n })
  })

  it('puts the payer, permitValue and nonce in the signed SubscriptionIntent message', () => {
    const nonce = `0x${'ab'.repeat(32)}` as const
    const typed = buildSubscriptionIntentTypedData({
      chainId: 5042002,
      verifyingContract: '0x0000000000000000000000000000000000000001',
      payer: '0x0000000000000000000000000000000000000003',
      merchantId: 1n,
      token: '0x0000000000000000000000000000000000000002',
      amount: 10n,
      interval: 60,
      startAt: 0n,
      endAt: 0n,
      permitDeadline: 99n,
      permitValue: 2n ** 256n - 1n,
      nonce,
    })
    expect(typed.message).toMatchObject({
      payer: '0x0000000000000000000000000000000000000003',
      permitValue: 2n ** 256n - 1n,
      nonce,
    })
  })
})
