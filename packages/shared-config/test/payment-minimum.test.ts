import { describe, expect, it } from 'vitest'
import { MINIMUM_PAYMENT_AMOUNT } from '../src/index.js'

describe('MINIMUM_PAYMENT_AMOUNT', () => {
  it('is 1.00 in 6-decimal base units', () => {
    expect(MINIMUM_PAYMENT_AMOUNT).toBe(1_000_000n)
  })
})
