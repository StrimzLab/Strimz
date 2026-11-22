import { describe, expect, it, vi } from 'vitest'

import { meterSignatures, type PrivyWalletApi } from '../src/index.js'

const tx = {
  type: 2 as const,
  chain_id: 5042,
  to: '0x0000000000000000000000000000000000000001',
  data: '0x',
  value: '0x0',
  nonce: 0,
  gas_limit: '0x1',
  max_fee_per_gas: '0x1',
  max_priority_fee_per_gas: '0x1',
}

const api = (sign: () => Promise<`0x${string}`>): PrivyWalletApi => ({
  walletAddress: () => Promise.resolve('0x0'),
  signTransaction: sign,
})

// ADR-2026-11-22-privy-server-signers: stay inside Privy's free 50k a month.
describe('meterSignatures', () => {
  it('counts each signature by calendar month and warns once at the threshold', async () => {
    const counts = new Map<string, number>()
    const incr = vi.fn((key: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1)
      return Promise.resolve(counts.get(key) ?? 0)
    })
    const onWarn = vi.fn(() => Promise.resolve())
    const metered = meterSignatures(
      api(() => Promise.resolve('0xsigned')),
      {
        incr,
        warnAt: 2,
        onWarn,
        onError: vi.fn(),
        now: () => new Date('2027-01-31T23:59:00Z'),
      },
    )
    for (let i = 0; i < 3; i++) expect(await metered.signTransaction('w', tx)).toBe('0xsigned')
    expect(incr).toHaveBeenCalledWith('privy:signatures:2027-01')
    expect(onWarn).toHaveBeenCalledTimes(1)
    expect(onWarn).toHaveBeenCalledWith(2, '2027-01')
  })

  it('does not count a refused signature', async () => {
    const incr = vi.fn(() => Promise.resolve(1))
    const metered = meterSignatures(
      api(() => Promise.reject(new Error('refused'))),
      {
        incr,
        warnAt: 1,
        onWarn: vi.fn(() => Promise.resolve()),
        onError: vi.fn(),
      },
    )
    await expect(metered.signTransaction('w', tx)).rejects.toThrow('refused')
    expect(incr).not.toHaveBeenCalled()
  })

  it('still returns the signature when counting fails, and reports the failure', async () => {
    const onError = vi.fn()
    const metered = meterSignatures(
      api(() => Promise.resolve('0xsigned')),
      {
        incr: () => Promise.reject(new Error('redis down')),
        warnAt: 1,
        onWarn: vi.fn(() => Promise.resolve()),
        onError,
      },
    )
    expect(await metered.signTransaction('w', tx)).toBe('0xsigned')
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
  })
})
