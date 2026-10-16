import { describe, expect, it } from 'vitest'
import { parseGwei } from 'viem'

import {
  GasPricingService,
  __testing__,
} from '../../../../src/modules/relay/gas-pricing.service.js'
import type { ChainService } from '../../../../src/infra/chain/chain.service.js'

function makeChain(baseFeePerGas: bigint | null): ChainService {
  return {
    client: {
      getBlock(): Promise<{ baseFeePerGas: bigint | null }> {
        return Promise.resolve({ baseFeePerGas })
      },
    },
    environment: 'testnet',
    getBlockNumber: () => Promise.resolve(0n),
  } as unknown as ChainService
}

describe('GasPricingService', () => {
  it('returns (2*baseFee + tip) under normal conditions', async () => {
    const baseFee = parseGwei('50')
    const svc = new GasPricingService(makeChain(baseFee))
    const { maxFeePerGas, maxPriorityFeePerGas } = await svc.compute()
    // tip default = 1 gwei
    expect(maxPriorityFeePerGas).toBe(parseGwei('1'))
    expect(maxFeePerGas).toBe(baseFee * 2n + parseGwei('1'))
  })

  it('floors maxFeePerGas at Arc minimum + tip when baseFee is low', async () => {
    // Stale or unusually-low base fee — must still respect the 20 Gwei floor.
    const baseFee = parseGwei('1')
    const svc = new GasPricingService(makeChain(baseFee))
    const { maxFeePerGas } = await svc.compute()
    const expectedFloor = __testing__.ARC_MIN_BASE_FEE_WEI + parseGwei('1')
    expect(maxFeePerGas).toBe(expectedFloor)
  })

  it('pays at least the base fee when it is above 200 gwei', async () => {
    const baseFee = parseGwei('500')
    const svc = new GasPricingService(makeChain(baseFee))
    const { maxFeePerGas } = await svc.compute()
    expect(maxFeePerGas).toBe(baseFee * 2n + parseGwei('1'))
  })

  it("prices at Arc's maximum base fee without clamping", async () => {
    const baseFee = parseGwei('20000')
    const svc = new GasPricingService(makeChain(baseFee))
    const { maxFeePerGas } = await svc.compute()
    expect(maxFeePerGas).toBe(baseFee * 2n + parseGwei('1'))
  })

  it("refuses a base fee above Arc's maximum, naming the reading", async () => {
    const svc = new GasPricingService(makeChain(parseGwei('20001')))
    await expect(svc.compute()).rejects.toThrow(/20001000000000/u)
  })

  it('rejects when the RPC has no baseFeePerGas', async () => {
    const svc = new GasPricingService(makeChain(null))
    await expect(svc.compute()).rejects.toThrow(/baseFeePerGas/u)
  })

  it('honours a bumped priority tip on retry', async () => {
    const baseFee = parseGwei('30')
    const svc = new GasPricingService(makeChain(baseFee))
    const { maxFeePerGas, maxPriorityFeePerGas } = await svc.compute({ priorityFeeGwei: 5 })
    expect(maxPriorityFeePerGas).toBe(parseGwei('5'))
    expect(maxFeePerGas).toBe(baseFee * 2n + parseGwei('5'))
  })

  it('rejects when the chain client throws', async () => {
    const broken = {
      client: {
        getBlock(): Promise<never> {
          return Promise.reject(new Error('rpc unavailable'))
        },
      },
      environment: 'testnet',
      getBlockNumber: () => Promise.resolve(0n),
    } as unknown as ChainService
    const svc = new GasPricingService(broken)
    await expect(svc.compute()).rejects.toThrow('rpc unavailable')
  })
})
