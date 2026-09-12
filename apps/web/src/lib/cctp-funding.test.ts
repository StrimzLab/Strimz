import { describe, expect, it } from 'vitest'

import {
  burnAmountFor,
  defaultMaxFee,
  hasArrived,
  needsFunding,
  preflightRefusal,
  smartWalletRefusal,
} from './cctp-funding'

const USDC = (whole: number): bigint => BigInt(whole) * 1_000_000n

describe('defaultMaxFee', () => {
  it('is 2bps of the amount', () => {
    expect(defaultMaxFee(USDC(50))).toBe(10_000n) // 0.01 USDC on $50
  })

  it('sits above the ~1bps Circle charges', () => {
    for (const amount of [USDC(1), USDC(50), USDC(1000), USDC(100_000)]) {
      expect(defaultMaxFee(amount)).toBeGreaterThanOrEqual(amount / 10_000n)
    }
  })

  it('never exceeds 1% of the payment', () => {
    for (const amount of [USDC(1), USDC(20), USDC(5000)]) {
      expect(defaultMaxFee(amount)).toBeLessThan(amount / 100n)
    }
  })

  it('floors to zero on dust rather than throwing', () => {
    expect(defaultMaxFee(1n)).toBe(0n)
    expect(defaultMaxFee(0n)).toBe(0n)
  })
})

describe('burnAmountFor', () => {
  it('burns the payment plus the fee ceiling', () => {
    expect(burnAmountFor(USDC(50), 10_000n)).toBe(50_010_000n)
  })

  it('never burns less than the payment', () => {
    for (const amount of [0n, 1n, USDC(1), USDC(9999)]) {
      expect(burnAmountFor(amount, defaultMaxFee(amount))).toBeGreaterThanOrEqual(amount)
    }
  })
})

/**
 * The invariant the whole design rests on: after Circle takes any fee
 * up to the ceiling, the payer still holds at least what they owe.
 *
 * The original version burned exactly `amount`, so any non-zero fee
 * left them short and the mint wait could never succeed. These cases
 * are the regression guard for that.
 */
describe('gross-up invariant: what lands covers what is owed', () => {
  const amounts = [USDC(1), USDC(5), USDC(20), USDC(50), USDC(999), USDC(100_000), 1_000_001n]

  it.each(amounts)('holds for %s base units at every fee up to the ceiling', (amount) => {
    const maxFee = defaultMaxFee(amount)
    const burned = burnAmountFor(amount, maxFee)
    // Sample the fee space including both ends.
    const fees = new Set([0n, 1n, maxFee / 2n, maxFee - 1n, maxFee].filter((f) => f >= 0n))
    for (const fee of fees) {
      const landed = burned - fee
      expect(hasArrived(landed, amount)).toBe(true)
    }
  })

  it('would have failed under the old burn-exactly-amount behaviour', () => {
    // Kept as a live demonstration of the bug this guards, so the
    // invariant above cannot be quietly weakened back.
    const amount = USDC(50)
    const landedWithoutGrossUp = amount - defaultMaxFee(amount)
    expect(hasArrived(landedWithoutGrossUp, amount)).toBe(false)
  })

  it('leaves at most the fee ceiling as dust when Circle charges nothing', () => {
    const amount = USDC(50)
    const maxFee = defaultMaxFee(amount)
    expect(burnAmountFor(amount, maxFee) - amount).toBe(maxFee)
  })

  it('holds for a caller-supplied fee ceiling', () => {
    const amount = USDC(50)
    const maxFee = USDC(2)
    expect(hasArrived(burnAmountFor(amount, maxFee) - maxFee, amount)).toBe(true)
  })
})

describe('hasArrived', () => {
  it('is satisfied by an exact balance', () => {
    expect(hasArrived(USDC(50), USDC(50))).toBe(true)
  })

  it('is satisfied by a surplus', () => {
    expect(hasArrived(USDC(51), USDC(50))).toBe(true)
  })

  it('is not satisfied one base unit short', () => {
    expect(hasArrived(USDC(50) - 1n, USDC(50))).toBe(false)
  })
})

describe('needsFunding', () => {
  it('is false while the balance is still loading', () => {
    // Otherwise the page flashes a funding prompt at someone who is
    // already holding USDC on Arc.
    expect(needsFunding(undefined, USDC(50))).toBe(false)
  })

  it('is true when the payer is short', () => {
    expect(needsFunding(USDC(10), USDC(50))).toBe(true)
  })

  it('is false when the payer has exactly enough', () => {
    expect(needsFunding(USDC(50), USDC(50))).toBe(false)
  })

  it('is false when the payer has more than enough', () => {
    expect(needsFunding(USDC(500), USDC(50))).toBe(false)
  })

  it('is false with a zero balance and a zero amount', () => {
    // A session still loading reports amount 0; never prompt on that.
    expect(needsFunding(0n, 0n)).toBe(false)
  })

  it('is true with a zero balance and a real amount', () => {
    expect(needsFunding(0n, USDC(50))).toBe(true)
  })
})

describe('preflightRefusal', () => {
  it('lets a fundable session through', () => {
    expect(preflightRefusal({ fundable: true, reason: null, bridgeTxHash: null })).toBeNull()
  })

  it('surfaces the server reason verbatim', () => {
    expect(
      preflightRefusal({ fundable: false, reason: 'session is cancelled', bridgeTxHash: null }),
    ).toBe('session is cancelled')
  })

  it('falls back to a generic reason when the server gives none', () => {
    expect(preflightRefusal({ fundable: false, reason: null, bridgeTxHash: null })).toMatch(
      /no longer be paid/i,
    )
  })

  it('refuses a second burn when one is already in flight', () => {
    expect(
      preflightRefusal({ fundable: true, reason: null, bridgeTxHash: `0x${'ab'.repeat(32)}` }),
    ).toMatch(/already on its way/i)
  })

  it('prefers the unfundable reason over the in-flight message', () => {
    expect(
      preflightRefusal({
        fundable: false,
        reason: 'this session is already paid',
        bridgeTxHash: `0x${'ab'.repeat(32)}`,
      }),
    ).toBe('this session is already paid')
  })
})

describe('smartWalletRefusal', () => {
  it('allows an EOA', () => {
    expect(smartWalletRefusal('0x')).toBeNull()
  })

  it('allows an address the node reports no code for', () => {
    expect(smartWalletRefusal(undefined)).toBeNull()
  })

  it('blocks any address carrying bytecode on Arc', () => {
    expect(smartWalletRefusal('0x60806040')).toMatch(/smart-contract wallets/i)
  })

  it('says why, and what to do instead', () => {
    const msg = smartWalletRefusal('0x60806040')
    expect(msg).toMatch(/do not control/i)
    expect(msg).toMatch(/EOA/)
  })
})
