import { describe, expect, it } from 'vitest'

import { walletSignature } from '../wallet-signature'

const rs = 'ab'.repeat(64)

describe('walletSignature', () => {
  it("raises a 0/1 v to 27/28 for an ordinary wallet's ECDSA signature", () => {
    expect(walletSignature(`0x${rs}00`, '0x')).toBe(`0x${rs}1b`)
    expect(walletSignature(`0x${rs}01`, undefined)).toBe(`0x${rs}1c`)
  })

  it('leaves a signature that already has v 27/28 alone', () => {
    expect(walletSignature(`0x${rs}1c`, '0x')).toBe(`0x${rs}1c`)
  })

  it("never touches a smart wallet's signature, even one 65 bytes long", () => {
    expect(walletSignature(`0x${rs}00`, '0x6080604052')).toBe(`0x${rs}00`)
    const long = `0x${'cd'.repeat(300)}` as const
    expect(walletSignature(long, '0x6080604052')).toBe(long)
  })
})
