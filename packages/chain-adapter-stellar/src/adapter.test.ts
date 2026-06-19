import { AdapterNotImplementedError, InvalidAddressError } from '@strimz/chain-adapter'
import { describe, expect, it } from 'vitest'

import { StellarChainAdapter } from './adapter.js'
import type { StellarChainConfig } from './config.js'

const VALID_G = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57'
const VALID_C = 'CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA'

function makeAdapter(): StellarChainAdapter {
  const config: StellarChainConfig = {
    chainId: 'stellar:testnet',
    display: 'Stellar testnet',
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    contracts: { payments: '', subscription: '', feeCollector: '' },
    usdcSac: null,
  }
  return new StellarChainAdapter(config)
}

describe('StellarChainAdapter identity', () => {
  it('reports the configured chain id', () => {
    expect(makeAdapter().chainId).toBe('stellar:testnet')
  })

  it('reports the stellar family', () => {
    expect(makeAdapter().family).toBe('stellar')
  })

  it('surfaces the stellar capabilities', () => {
    const caps = makeAdapter().capabilities
    expect(caps.feeAbstraction).toBe('fee-bump')
    expect(caps.permitStyle).toBe('sep-41-approve')
    expect(caps.permitHasExpiry).toBe(true)
    expect(caps.supportsSponsoredReserves).toBe(true)
  })
})

describe('StellarChainAdapter addresses', () => {
  it('validates a G-account', () => {
    expect(makeAdapter().validateAddress(VALID_G)).toBe(true)
  })

  it('validates a C-contract', () => {
    expect(makeAdapter().validateAddress(VALID_C)).toBe(true)
  })

  it('rejects non-Stellar input via validateAddress', () => {
    expect(makeAdapter().validateAddress('0x' + 'a'.repeat(40))).toBe(false)
  })

  it('returns valid addresses canonical from normaliseAddress', () => {
    expect(makeAdapter().normaliseAddress(VALID_G)).toBe(VALID_G)
  })

  it('throws InvalidAddressError from normaliseAddress on bad input', () => {
    expect(() => makeAdapter().normaliseAddress('not-an-address')).toThrow(InvalidAddressError)
  })
})

describe('StellarChainAdapter submission stubs (M5a)', () => {
  // The submission methods are deliberately unimplemented in M5a — the
  // tests below assert the structured `adapter_not_implemented` error
  // shape so a downstream caller can distinguish "not wired yet" from
  // an actual runtime failure.
  it('throws AdapterNotImplementedError from preparePayment', () => {
    expect(() =>
      makeAdapter().preparePayment({
        merchantId: 'merch_1',
        idempotencyKey: 'idem_1',
        currency: 'USDC',
        amount: '1000000',
        payerAddress: VALID_G,
        ref: 'ref_1',
      }),
    ).toThrow(AdapterNotImplementedError)
  })

  it('throws AdapterNotImplementedError from chargeSubscription', () => {
    expect(() =>
      makeAdapter().chargeSubscription({
        subscriptionId: 'sub_1',
        idempotencyKey: 'idem_1',
        periodEndAt: new Date().toISOString(),
        amount: '1000000',
      }),
    ).toThrow(AdapterNotImplementedError)
  })

  it('throws AdapterNotImplementedError from refreshAllowance', () => {
    const adapter = makeAdapter()
    expect(adapter.refreshAllowance).toBeDefined()
    expect(() =>
      adapter.refreshAllowance?.({ subscriptionId: 'sub_1', idempotencyKey: 'idem_1' }),
    ).toThrow(AdapterNotImplementedError)
  })
})
