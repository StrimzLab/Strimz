import { describe, expect, it } from 'vitest'
import { toCurrencyAmounts } from '../../../src/common/money/currency-amounts.js'

describe('toCurrencyAmounts', () => {
  it('returns every currency, zero when a currency has no row', () => {
    expect(toCurrencyAmounts([])).toEqual({ USDC: '0', EURC: '0' })
    expect(toCurrencyAmounts([{ currency: 'EURC', amount: '3000000' }])).toEqual({
      USDC: '0',
      EURC: '3000000',
    })
    expect(
      toCurrencyAmounts([
        { currency: 'USDC', amount: '123456789012345678901234567890' },
        { currency: 'EURC', amount: '1' },
      ]),
    ).toEqual({ USDC: '123456789012345678901234567890', EURC: '1' })
  })

  it('throws on an unknown currency', () => {
    expect(() => toCurrencyAmounts([{ currency: 'USYC', amount: '1' }])).toThrow(/unknown currency/)
  })

  it('throws when a currency appears twice instead of adding the rows', () => {
    expect(() =>
      toCurrencyAmounts([
        { currency: 'USDC', amount: '1' },
        { currency: 'USDC', amount: '2' },
      ]),
    ).toThrow(/more than one USDC row/)
  })

  it('rejects an amount that is not a base-unit integer', () => {
    expect(() => toCurrencyAmounts([{ currency: 'USDC', amount: '-5' }])).toThrow()
  })
})
