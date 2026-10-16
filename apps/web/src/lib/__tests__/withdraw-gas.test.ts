import { describe, expect, it } from 'vitest'
import {
  bufferedGasQuote,
  checkWithdrawAmount,
  gasReserveUsdc,
  maxWithdrawable,
} from '../withdraw-gas'

const estimate = { gas: 50_000n, maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 1n }

describe('bufferedGasQuote', () => {
  it('adds a fifth to the gas limit and doubles the max fee', () => {
    expect(bufferedGasQuote(estimate)).toEqual({
      gas: 60_000n,
      maxFeePerGas: 60_000_000_000n,
      maxPriorityFeePerGas: 1n,
    })
  })

  it('rounds the gas limit up', () => {
    expect(bufferedGasQuote({ ...estimate, gas: 21_001n }).gas).toBe(25_202n)
  })
})

describe('gasReserveUsdc', () => {
  it('converts the worst case native fee (18 decimals) to USDC base units (6 decimals), rounding up', () => {
    const quote = { gas: 60_000n, maxFeePerGas: 60_000_000_000n, maxPriorityFeePerGas: 1n }
    expect(gasReserveUsdc(quote)).toBe(3_600n)
    expect(gasReserveUsdc({ ...quote, gas: 60_001n })).toBe(3_601n)
  })
})

describe('maxWithdrawable', () => {
  it('holds back the gas reserve from a USDC balance', () => {
    expect(
      maxWithdrawable({
        currency: 'USDC',
        balance: 10_000_000n,
        usdcBalance: 10_000_000n,
        reserve: 3_600n,
      }),
    ).toBe(9_996_400n)
  })

  it('never goes below zero when USDC cannot cover gas', () => {
    expect(
      maxWithdrawable({ currency: 'USDC', balance: 1_000n, usdcBalance: 1_000n, reserve: 3_600n }),
    ).toBe(0n)
  })

  it('allows the whole EURC balance because gas is paid in USDC', () => {
    expect(
      maxWithdrawable({
        currency: 'EURC',
        balance: 5_000_000n,
        usdcBalance: 10_000n,
        reserve: 3_600n,
      }),
    ).toBe(5_000_000n)
  })
})

describe('checkWithdrawAmount', () => {
  const base = { balance: 10_000_000n, usdcBalance: 10_000_000n, reserve: 3_600n }

  it('accepts a USDC amount that leaves the gas reserve', () => {
    expect(checkWithdrawAmount({ ...base, currency: 'USDC', amount: 9_996_400n })).toEqual({
      ok: true,
    })
  })

  it('rejects the full USDC balance because gas would not be covered', () => {
    expect(checkWithdrawAmount({ ...base, currency: 'USDC', amount: 10_000_000n })).toEqual({
      ok: false,
      reason: 'insufficient_gas',
    })
  })

  it('rejects more than the balance', () => {
    expect(checkWithdrawAmount({ ...base, currency: 'USDC', amount: 10_000_001n })).toEqual({
      ok: false,
      reason: 'exceeds_balance',
    })
  })

  it('rejects zero', () => {
    expect(checkWithdrawAmount({ ...base, currency: 'USDC', amount: 0n })).toEqual({
      ok: false,
      reason: 'not_positive',
    })
  })

  it('rejects an EURC withdrawal when USDC cannot pay for gas', () => {
    expect(
      checkWithdrawAmount({
        currency: 'EURC',
        amount: 1_000_000n,
        balance: 5_000_000n,
        usdcBalance: 3_599n,
        reserve: 3_600n,
      }),
    ).toEqual({ ok: false, reason: 'insufficient_gas' })
  })

  it('accepts an EURC withdrawal of the full balance when USDC covers gas', () => {
    expect(
      checkWithdrawAmount({
        currency: 'EURC',
        amount: 5_000_000n,
        balance: 5_000_000n,
        usdcBalance: 3_600n,
        reserve: 3_600n,
      }),
    ).toEqual({ ok: true })
  })
})
