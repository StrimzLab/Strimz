import { describe, expect, it } from 'vitest'

import { feeSplit } from '../../../src/common/money/fee-split.js'

// Same rule as the contracts: fee = amount * feeBps / 10_000, rounded down (#382).
describe('feeSplit', () => {
  it.each([
    [1_000_000n, 50, 5_000n],
    [1_000_199n, 50, 5_000n],
    [199n, 50, 0n],
    [123_456_789n, 40, 493_827n],
    [100_000_000n, 150, 1_500_000n],
    [10n ** 15n, 500, 5n * 10n ** 13n],
    [5_000_000n, 0, 0n],
  ])('%s at %s bps takes a fee of %s', (amount, feeBps, fee) => {
    expect(feeSplit(amount, feeBps)).toEqual({ feeAmount: fee, netAmount: amount - fee })
  })

  it('never takes more than the rate', () => {
    for (let amount = 1n; amount < 2_000n; amount += 7n) {
      const { feeAmount, netAmount } = feeSplit(amount, 50)
      expect(feeAmount * 10_000n).toBeLessThanOrEqual(amount * 50n)
      expect(feeAmount + netAmount).toBe(amount)
    }
  })

  it.each([-1, 501, 1.5])('rejects a fee rate of %s', (feeBps) => {
    expect(() => feeSplit(1_000_000n, feeBps)).toThrow()
  })
})
