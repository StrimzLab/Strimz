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
      async getBlock(): Promise<{ baseFeePerGas: bigint | null }> {
        return { baseFeePerGas }
      },
    },
    environment: 'testnet',
    getBlockNumber: async () => 0n,
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

  it('clamps maxFeePerGas at the safety cap when baseFee is absurdly high', async () => {
    const baseFee = parseGwei('500') // 2x = 1000 gwei, well above 200 gwei cap
    const svc = new GasPricingService(makeChain(baseFee))
    const { maxFeePerGas } = await svc.compute()
    expect(maxFeePerGas).toBe(__testing__.SAFETY_MAX_FEE_WEI)
  })

  it('falls back to the floor when the RPC has no baseFeePerGas', async () => {
    const svc = new GasPricingService(makeChain(null))
    const { maxFeePerGas } = await svc.compute()
    // baseFee fallback is the floor; 2 * floor + tip
    expect(maxFeePerGas).toBe(__testing__.ARC_MIN_BASE_FEE_WEI * 2n + parseGwei('1'))
  })

  it('honours a bumped priority tip on retry', async () => {
    const baseFee = parseGwei('30')
    const svc = new GasPricingService(makeChain(baseFee))
    const { maxFeePerGas, maxPriorityFeePerGas } = await svc.compute({ priorityFeeGwei: 5 })
    expect(maxPriorityFeePerGas).toBe(parseGwei('5'))
    expect(maxFeePerGas).toBe(baseFee * 2n + parseGwei('5'))
  })

  it('does not crash when the chain client throws', async () => {
    const broken = {
      client: {
        async getBlock(): Promise<never> {
          throw new Error('rpc unavailable')
        },
      },
      environment: 'testnet',
      getBlockNumber: async () => 0n,
    } as unknown as ChainService
    const svc = new GasPricingService(broken)
    const { maxFeePerGas, maxPriorityFeePerGas } = await svc.compute()
    // Falls back to floor, returns a usable price rather than throwing.
    expect(maxPriorityFeePerGas).toBe(parseGwei('1'))
    expect(maxFeePerGas).toBe(__testing__.ARC_MIN_BASE_FEE_WEI * 2n + parseGwei('1'))
  })
})
