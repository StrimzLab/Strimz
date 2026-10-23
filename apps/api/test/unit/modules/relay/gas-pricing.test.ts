import { describe, expect, it } from 'vitest'
import { numberToHex, parseGwei, type Hex } from 'viem'

import {
  GasPricingService,
  __testing__,
} from '../../../../src/modules/relay/gas-pricing.service.js'
import type { ChainService } from '../../../../src/infra/chain/chain.service.js'

const nextFee = (wei: bigint): Hex => numberToHex(wei, { size: 8 })

function makeChain(opts: { extraData: Hex; tip?: bigint; latestBaseFee?: bigint }): {
  chain: ChainService
  tipReads: () => number
} {
  let reads = 0
  const chain = {
    client: {
      getBlock() {
        return Promise.resolve({
          number: 7n,
          extraData: opts.extraData,
          baseFeePerGas: opts.latestBaseFee ?? parseGwei('20'),
        })
      },
      request({ method }: { method: string }) {
        if (method !== 'eth_maxPriorityFeePerGas') {
          return Promise.reject(new Error(`unexpected ${method}`))
        }
        reads += 1
        return Promise.resolve(numberToHex(opts.tip ?? 0n))
      },
    },
    environment: 'testnet',
    getBlockNumber: () => Promise.resolve(0n),
  } as unknown as ChainService
  return { chain, tipReads: () => reads }
}

const bump = (wei: bigint) => (wei * 1125n + 999n) / 1000n

describe('GasPricingService', () => {
  it('sends the first attempt with no tip and does not ask for one', async () => {
    const { chain, tipReads } = makeChain({ extraData: nextFee(parseGwei('20')) })
    const price = await new GasPricingService(chain).compute()
    expect(price).toEqual({ maxFeePerGas: parseGwei('40'), maxPriorityFeePerGas: 0n })
    expect(tipReads()).toBe(0)
  })

  it("prices from the next block's base fee in extra_data, not the latest block's", async () => {
    const { chain } = makeChain({
      extraData: nextFee(parseGwei('25')),
      latestBaseFee: parseGwei('20'),
    })
    const { maxFeePerGas } = await new GasPricingService(chain).compute()
    expect(maxFeePerGas).toBe(parseGwei('50'))
  })

  it("uses Arc's recommended tip on a retry", async () => {
    const { chain, tipReads } = makeChain({
      extraData: nextFee(parseGwei('20')),
      tip: parseGwei('0.5'),
    })
    const price = await new GasPricingService(chain).compute({ retry: true })
    expect(price).toEqual({
      maxFeePerGas: parseGwei('40.5'),
      maxPriorityFeePerGas: parseGwei('0.5'),
    })
    expect(tipReads()).toBe(1)
  })

  it('floors the max fee at the 20 gwei protocol minimum', async () => {
    const { chain } = makeChain({ extraData: nextFee(parseGwei('1')) })
    const { maxFeePerGas } = await new GasPricingService(chain).compute()
    expect(maxFeePerGas).toBe(__testing__.ARC_MIN_BASE_FEE_WEI)
  })

  it("prices at Arc's maximum base fee without clamping", async () => {
    const { chain } = makeChain({ extraData: nextFee(parseGwei('20000')) })
    const { maxFeePerGas } = await new GasPricingService(chain).compute()
    expect(maxFeePerGas).toBe(parseGwei('40000'))
  })

  it("refuses a next base fee above Arc's maximum, naming the reading", async () => {
    const { chain } = makeChain({ extraData: nextFee(parseGwei('20001')) })
    await expect(new GasPricingService(chain).compute()).rejects.toThrow(/20001000000000/u)
  })

  it.each([['0x' as Hex], ['0x00000004a817c8' as Hex], ['0x0000000004a817c800' as Hex]])(
    'refuses extra_data %s that is not 8 bytes',
    async (extraData) => {
      const { chain } = makeChain({ extraData })
      await expect(new GasPricingService(chain).compute()).rejects.toThrow(/extra_data.*block 7/u)
    },
  )

  it('raises a replacement at least 12.5% above the fees it replaces', async () => {
    const { chain } = makeChain({ extraData: nextFee(parseGwei('20')), tip: 0n })
    const previous = { maxFeePerGas: parseGwei('40'), maxPriorityFeePerGas: parseGwei('1') }
    const price = await new GasPricingService(chain).compute({ retry: true, previous })
    expect(price.maxFeePerGas).toBe(bump(parseGwei('40')))
    expect(price.maxPriorityFeePerGas).toBe(bump(parseGwei('1')))
    expect(price.maxFeePerGas * 100n).toBeGreaterThanOrEqual(previous.maxFeePerGas * 110n)
    expect(price.maxPriorityFeePerGas * 100n).toBeGreaterThanOrEqual(
      previous.maxPriorityFeePerGas * 110n,
    )
  })

  it('still clears the replacement bump when the base fee fell since the first send', async () => {
    const { chain } = makeChain({ extraData: nextFee(parseGwei('20')), tip: parseGwei('0.5') })
    const previous = { maxFeePerGas: parseGwei('60'), maxPriorityFeePerGas: 0n }
    const price = await new GasPricingService(chain).compute({ retry: true, previous })
    expect(price.maxFeePerGas).toBe(bump(parseGwei('60')))
    expect(price.maxPriorityFeePerGas).toBe(parseGwei('0.5'))
  })

  it('keeps the fresh price when it is already above the bump', async () => {
    const { chain } = makeChain({ extraData: nextFee(parseGwei('30')), tip: parseGwei('2') })
    const previous = { maxFeePerGas: parseGwei('40'), maxPriorityFeePerGas: parseGwei('1') }
    const price = await new GasPricingService(chain).compute({ retry: true, previous })
    expect(price).toEqual({ maxFeePerGas: parseGwei('62'), maxPriorityFeePerGas: parseGwei('2') })
  })

  it('rejects a malformed recommended tip', async () => {
    const chain = {
      client: {
        getBlock: () => Promise.resolve({ number: 7n, extraData: nextFee(parseGwei('20')) }),
        request: () => Promise.resolve('lots'),
      },
    } as unknown as ChainService
    await expect(new GasPricingService(chain).compute({ retry: true })).rejects.toThrow(
      /eth_maxPriorityFeePerGas/u,
    )
  })

  it('rejects when the chain client throws', async () => {
    const broken = {
      client: {
        getBlock(): Promise<never> {
          return Promise.reject(new Error('rpc unavailable'))
        },
      },
    } as unknown as ChainService
    await expect(new GasPricingService(broken).compute()).rejects.toThrow('rpc unavailable')
  })
})
