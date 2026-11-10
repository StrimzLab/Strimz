import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  buildSubscriptionIntentTypedData,
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

  it('puts permitValue and nonce in the signed SubscriptionIntent message', () => {
    const nonce = `0x${'ab'.repeat(32)}` as const
    const typed = buildSubscriptionIntentTypedData({
      chainId: 5042002,
      verifyingContract: '0x0000000000000000000000000000000000000001',
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
    expect(typed.message).toMatchObject({ permitValue: 2n ** 256n - 1n, nonce })
  })
})
