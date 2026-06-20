import { Account, SorobanDataBuilder, xdr } from '@stellar/stellar-sdk'
import { InvalidAddressError } from '@strimz/chain-adapter'
import { describe, expect, it } from 'vitest'

import { StellarChainAdapter } from './adapter.js'
import type { StellarChainConfig } from './config.js'
import type { StellarRpcClient } from './rpc.js'

const VALID_G = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57'
const VALID_C = 'CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA'
// Test fixtures — valid Strkey-encoded contract IDs minted via
// `StrKey.encodeContract` from deterministic 32-byte seeds. Not real
// deployed contracts; they only need to round-trip through the SDK's
// checksum validation.
const VALID_MERCHANT_C = 'CBWW23LNNVWW23LNNVWW23LNNVWW23LNNVWW23LNNVWW23LNNVWW2U5Z'
const FAKE_PAYMENTS_CONTRACT = 'CBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHAGEP'
const FAKE_SUBSCRIPTION_CONTRACT = 'CBZXG43TONZXG43TONZXG43TONZXG43TONZXG43TONZXG43TONZXHWMI'
const FAKE_FEE_COLLECTOR = 'CBTGMZTGMZTGMZTGMZTGMZTGMZTGMZTGMZTGMZTGMZTGMZTGMZTGM2VL'
const FAKE_USDC_SAC = 'CB2XK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XKW4H'

function makeAdapter(opts?: {
  contracts?: Partial<StellarChainConfig['contracts']>
  rpcClient?: StellarRpcClient
}): StellarChainAdapter {
  const config: StellarChainConfig = {
    chainId: 'stellar:testnet',
    display: 'Stellar testnet',
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    contracts: {
      payments: '',
      subscription: '',
      feeCollector: FAKE_FEE_COLLECTOR,
      ...opts?.contracts,
    },
    usdcSac: FAKE_USDC_SAC,
  }
  return new StellarChainAdapter(config, opts?.rpcClient)
}

/**
 * In-memory mock RPC client. Returns a deterministic account +
 * synthesises a minimal successful simulation response so the adapter's
 * `assembleViaSimulation` path stays exercisable without a network.
 */
function makeMockRpc(): StellarRpcClient {
  return {
    async getAccount(address: string) {
      // Sequence 0 is fine — the builder bumps it during build.
      return new Account(address, '0')
    },
    async simulateTransaction(_tx) {
      // Return a parsed SimulateTransactionSuccessResponse — i.e. the
      // shape `parseRawSimulation` would produce. Carries the
      // `_parsed: true` marker so `assembleTransaction` skips its
      // own parsing pass and accepts these objects as-is. The empty
      // SorobanDataBuilder + 50k base fee mirror what a no-op
      // simulation against testnet would return; auth + retval stay
      // empty / void.
      return {
        _parsed: true,
        latestLedger: 1,
        minResourceFee: '50000',
        transactionData: new SorobanDataBuilder(),
        events: [],
        result: { auth: [], retval: xdr.ScVal.scvVoid() },
        cost: { cpuInsns: '0', memBytes: '0' },
      } as never
    },
  }
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

describe('StellarChainAdapter preparePayment (M5b)', () => {
  it('throws when StrimzPayments contract is not configured', async () => {
    await expect(
      makeAdapter().preparePayment({
        merchantId: 'merch_1',
        merchantAddress: VALID_MERCHANT_C,
        idempotencyKey: 'idem_1',
        currency: 'USDC',
        amount: '1000000',
        feeBps: 150,
        payerAddress: VALID_G,
        ref: 'ref_1',
      }),
    ).rejects.toThrow(/contract not configured/)
  })

  it('returns a Stellar envelope with the configured contract id + args', async () => {
    const adapter = makeAdapter({
      contracts: { payments: FAKE_PAYMENTS_CONTRACT, subscription: FAKE_SUBSCRIPTION_CONTRACT },
      rpcClient: makeMockRpc(),
    })

    const result = await adapter.preparePayment({
      merchantId: 'merch_1',
      merchantAddress: VALID_MERCHANT_C,
      idempotencyKey: 'idem_1',
      currency: 'USDC',
      amount: '5000000',
      feeBps: 150,
      payerAddress: VALID_G,
      ref: 'session_xyz',
    })

    expect(result.chainId).toBe('stellar:testnet')
    expect(result.envelope.family).toBe('stellar')
    const data = result.envelope.data as Record<string, unknown>
    expect(data.contractId).toBe(FAKE_PAYMENTS_CONTRACT)
    expect(data.functionName).toBe('pay')
    expect(data.networkPassphrase).toBe('Test SDF Network ; September 2015')
    expect(data.transactionXdr).toMatch(/^[A-Za-z0-9+/]+=*$/)

    const args = data.args as Record<string, unknown>
    expect(args.payer).toBe(VALID_G)
    expect(args.merchant).toBe(VALID_MERCHANT_C)
    expect(args.amount).toBe('5000000')
    expect(args.feeBps).toBe(150)
    expect(args.refId).toMatch(/^[0-9a-f]{64}$/) // sha-256 hex of 'session_xyz'
  })

  it('uses the configured USDC SAC verbatim when set', async () => {
    const adapter = makeAdapter({
      contracts: { payments: FAKE_PAYMENTS_CONTRACT, subscription: FAKE_SUBSCRIPTION_CONTRACT },
      rpcClient: makeMockRpc(),
    })
    const result = await adapter.preparePayment({
      merchantId: 'merch_1',
      merchantAddress: VALID_MERCHANT_C,
      idempotencyKey: 'idem_1',
      currency: 'USDC',
      amount: '1',
      feeBps: 0,
      payerAddress: VALID_G,
      ref: 'r',
    })
    const args = (result.envelope.data as Record<string, unknown>).args as Record<string, unknown>
    expect(args.asset).toBe(FAKE_USDC_SAC)
  })
})

describe('StellarChainAdapter prepareSubscriptionEnrolment (M5b)', () => {
  it('returns a Stellar envelope with enrol() function name + period args', async () => {
    const adapter = makeAdapter({
      contracts: { payments: FAKE_PAYMENTS_CONTRACT, subscription: FAKE_SUBSCRIPTION_CONTRACT },
      rpcClient: makeMockRpc(),
    })

    const result = await adapter.prepareSubscriptionEnrolment({
      merchantId: 'merch_1',
      merchantAddress: VALID_MERCHANT_C,
      idempotencyKey: 'idem_1',
      planId: 'plan_pro',
      customerId: 'cus_1',
      currency: 'USDC',
      amount: '10000000',
      intervalSeconds: 2_592_000,
      feeBps: 150,
      payerAddress: VALID_G,
      endAt: null,
    })

    const data = result.envelope.data as Record<string, unknown>
    expect(data.contractId).toBe(FAKE_SUBSCRIPTION_CONTRACT)
    expect(data.functionName).toBe('enrol')

    const args = data.args as Record<string, unknown>
    expect(args.amountPerPeriod).toBe('10000000')
    expect(args.periodSeconds).toBe(2_592_000)
    expect(args.endAt).toBeNull()
  })
})
