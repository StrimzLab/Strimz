import { describe, expect, it, vi } from 'vitest'

import { prepareArcSigning, WrongChainError } from '../arc-network'

function wallet(chainIds: number[], switchChain = vi.fn(() => Promise.resolve())) {
  const reads = [...chainIds]
  return {
    chainId: vi.fn(() => Promise.resolve(reads.length > 1 ? reads.shift() : reads[0])),
    switchChain,
  }
}

describe('prepareArcSigning', () => {
  it('signs for the configured chain without switching when the wallet is already on it', async () => {
    const w = wallet([5042002])
    await expect(prepareArcSigning(w, 'testnet')).resolves.toBe(5042002)
    expect(w.switchChain).not.toHaveBeenCalled()
  })

  it('switches a wallet on another chain to Arc before signing', async () => {
    const w = wallet([1, 5042])
    await expect(prepareArcSigning(w, 'mainnet')).resolves.toBe(5042)
    expect(w.switchChain).toHaveBeenCalledWith(5042)
  })

  it('refuses to sign when the payer declines the switch', async () => {
    const declined = vi.fn(() => Promise.reject(new Error('User rejected the request.')))
    const w = wallet([1], declined)
    await expect(prepareArcSigning(w, 'testnet')).rejects.toBeInstanceOf(WrongChainError)
    await expect(prepareArcSigning(w, 'testnet')).rejects.toThrow(/Switch your wallet to Arc/u)
  })

  it('refuses to sign when the wallet stays on another chain after the switch', async () => {
    const w = wallet([1, 1])
    await expect(prepareArcSigning(w, 'testnet')).rejects.toThrow(/Switch your wallet to Arc/u)
  })
})
