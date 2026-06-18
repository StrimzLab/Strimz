import { describe, expect, it } from 'vitest'

import { deriveMerchantWalletAddress } from './derive.js'

const DEPLOYER = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57'

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values)
}

describe('deriveMerchantWalletAddress', () => {
  it('returns a C-prefixed Strkey of canonical length', () => {
    const address = deriveMerchantWalletAddress({
      credentialId: bytes(1, 2, 3, 4, 5),
      deployer: DEPLOYER,
      network: 'testnet',
    })

    expect(address.startsWith('C')).toBe(true)
    expect(address.length).toBe(56)
  })

  it('is deterministic for the same inputs', () => {
    const args = {
      credentialId: bytes(1, 2, 3, 4, 5, 6, 7, 8),
      deployer: DEPLOYER,
      network: 'testnet' as const,
    }
    const a = deriveMerchantWalletAddress(args)
    const b = deriveMerchantWalletAddress(args)
    expect(a).toBe(b)
  })

  it('produces a different address for a different credential id', () => {
    const a = deriveMerchantWalletAddress({
      credentialId: bytes(1, 2, 3, 4, 5),
      deployer: DEPLOYER,
      network: 'testnet',
    })
    const b = deriveMerchantWalletAddress({
      credentialId: bytes(1, 2, 3, 4, 6),
      deployer: DEPLOYER,
      network: 'testnet',
    })
    expect(a).not.toBe(b)
  })

  it('produces a different address on testnet vs pubnet', () => {
    const args = { credentialId: bytes(7, 7, 7, 7), deployer: DEPLOYER }
    const testnet = deriveMerchantWalletAddress({ ...args, network: 'testnet' })
    const pubnet = deriveMerchantWalletAddress({ ...args, network: 'pubnet' })
    expect(testnet).not.toBe(pubnet)
  })
})
