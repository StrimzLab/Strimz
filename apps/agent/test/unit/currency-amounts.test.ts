import { describe, expect, it } from 'vitest'
import {
  currenciesToShow,
  formatAmount,
  toCurrencyAmounts,
} from '../../src/common/money/currency-amounts.js'

describe('toCurrencyAmounts', () => {
  it('fills every currency, zero when absent', () => {
    expect(toCurrencyAmounts([{ currency: 'EURC', amount: '5' }])).toEqual({ USDC: '0', EURC: '5' })
  })

  it('throws on an unknown currency', () => {
    expect(() => toCurrencyAmounts([{ currency: 'USDT', amount: '1' }])).toThrow(/unknown currency/)
  })

  it('throws on a repeated currency', () => {
    expect(() =>
      toCurrencyAmounts([
        { currency: 'USDC', amount: '1' },
        { currency: 'USDC', amount: '2' },
      ]),
    ).toThrow(/more than one USDC/)
  })

  it('throws on a non-integer amount', () => {
    expect(() => toCurrencyAmounts([{ currency: 'USDC', amount: '1.5' }])).toThrow()
  })
})

describe('currenciesToShow', () => {
  it('lists active currencies in a fixed order', () => {
    expect(currenciesToShow(new Set(['EURC', 'USDC']))).toEqual(['USDC', 'EURC'])
  })

  it('falls back to a single USDC block when nothing is active', () => {
    expect(currenciesToShow(new Set())).toEqual(['USDC'])
  })
})

describe('formatAmount', () => {
  it('formats base units with the currency', () => {
    expect(formatAmount(80_000_000n, 'USDC')).toBe('80 USDC')
    expect(formatAmount('1500000', 'EURC')).toBe('1.5 EURC')
    expect(formatAmount(-250_000n, 'USDC')).toBe('-0.25 USDC')
  })
})
