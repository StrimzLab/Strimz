import { Injectable } from '@nestjs/common'
import { hexToBigInt, isHex, parseGwei, size } from 'viem'

import { ChainService } from '../../infra/chain/chain.service.js'

export interface GasPrice {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/** Arc drops anything priced under this without an error. */
const ARC_MIN_BASE_FEE_WEI = parseGwei('20')

const ARC_MAX_BASE_FEE_WEI = parseGwei('20000')

/** Reth refuses a same-nonce replacement under +10% by default; 12.5% leaves room. */
const REPLACEMENT_BUMP_PER_MILLE = 1125n

/**
 * Tip 0 on the first send, Arc's recommended tip on retries, and 2x the next
 * block's base fee as headroom. Only base fee + tip is charged.
 */
@Injectable()
export class GasPricingService {
  constructor(private readonly chain: ChainService) {}

  async compute(opts?: { retry?: boolean; previous?: GasPrice }): Promise<GasPrice> {
    const nextBaseFee = await this.fetchNextBaseFee()
    let tip = opts?.retry ? await this.fetchRecommendedTip() : 0n
    const headroom = nextBaseFee * 2n
    let max = (headroom > ARC_MIN_BASE_FEE_WEI ? headroom : ARC_MIN_BASE_FEE_WEI) + tip

    const previous = opts?.previous
    if (previous) {
      tip = atLeast(tip, bumped(previous.maxPriorityFeePerGas))
      max = atLeast(max, bumped(previous.maxFeePerGas))
    }
    return { maxFeePerGas: max, maxPriorityFeePerGas: tip }
  }

  // Arc publishes the next block's base fee as 8 big-endian bytes in the header's extra_data.
  private async fetchNextBaseFee(): Promise<bigint> {
    const block = await this.chain.client.getBlock({ blockTag: 'latest' })
    if (size(block.extraData) !== 8) {
      throw new Error(
        `extra_data of block ${block.number} is ${block.extraData}, not an 8-byte base fee; cannot price an Arc relay`,
      )
    }
    const baseFee = hexToBigInt(block.extraData)
    if (baseFee > ARC_MAX_BASE_FEE_WEI) {
      throw new Error(
        `base fee ${baseFee} wei is above Arc's maximum ${ARC_MAX_BASE_FEE_WEI} wei; check ARC_RPC_URL or the Arc fee parameters`,
      )
    }
    return baseFee
  }

  private async fetchRecommendedTip(): Promise<bigint> {
    const raw: unknown = await this.chain.client.request({ method: 'eth_maxPriorityFeePerGas' })
    if (typeof raw !== 'string' || !isHex(raw, { strict: true })) {
      throw new Error(`eth_maxPriorityFeePerGas returned ${String(raw)}, not a hex quantity`)
    }
    return hexToBigInt(raw)
  }
}

function bumped(wei: bigint): bigint {
  return (wei * REPLACEMENT_BUMP_PER_MILLE + 999n) / 1000n
}

function atLeast(value: bigint, floor: bigint): bigint {
  return value > floor ? value : floor
}

export const __testing__ = {
  ARC_MIN_BASE_FEE_WEI,
  ARC_MAX_BASE_FEE_WEI,
}
