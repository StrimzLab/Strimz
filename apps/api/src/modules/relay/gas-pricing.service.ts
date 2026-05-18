import { Injectable, Logger } from '@nestjs/common'
import { parseGwei } from 'viem'

import { ChainService } from '../../infra/chain/chain.service.js'

export interface GasPrice {
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/**
 * Arc's protocol-level minimum base fee. Transactions below this are
 * silently dropped from the mempool — see the Arc gas-and-fees reference.
 * Encoded here in wei; 20 Gwei = 2e10 wei.
 */
const ARC_MIN_BASE_FEE_WEI = parseGwei('20')

/**
 * Sane upper bound to cap any local pricing miscalculation. Arc's
 * documented maximum base fee is 1e-3 USDC per gas unit (~6e14 wei
 * for an 18-decimal native), so a 200-Gwei ceiling stays comfortably
 * below worst-case while protecting against runaway fee-bump loops.
 */
const SAFETY_MAX_FEE_WEI = parseGwei('200')

/**
 * Computes EIP-1559 fee parameters for an outbound relay submission.
 *
 * Strategy:
 *  1. Read the latest base fee from `eth_feeHistory` (1 block, latest).
 *  2. Pick a priority tip — default 1 Gwei, configurable per-call for
 *     congestion-mode bumping.
 *  3. `maxFeePerGas = baseFee * 2 + tip` — gives one block of headroom
 *     against base-fee climb; standard pattern.
 *  4. Enforce floors: result must be at least `ARC_MIN_BASE_FEE_WEI + tip`,
 *     so transactions are never rejected for being below the protocol
 *     minimum, even when the mempool reports a stale lower base fee.
 *  5. Enforce ceiling: cap at `SAFETY_MAX_FEE_WEI` to refuse insane
 *     prices that would suggest a config bug.
 *
 * Returns wei-denominated bigints, ready to plug into a viem
 * `eip1559` transaction.
 */
@Injectable()
export class GasPricingService {
  private readonly log = new Logger(GasPricingService.name)

  constructor(private readonly chain: ChainService) {}

  async compute(opts?: { priorityFeeGwei?: number }): Promise<GasPrice> {
    const tip = parseGwei(String(opts?.priorityFeeGwei ?? 1))
    const baseFee = await this.fetchBaseFee()

    // 2× the latest base fee gives one block of headroom. Cheap on
    // Arc (sub-cent transactions), generous enough to survive a
    // small spike between estimation and inclusion.
    let max = baseFee * 2n + tip

    const floor = ARC_MIN_BASE_FEE_WEI + tip
    if (max < floor) max = floor

    if (max > SAFETY_MAX_FEE_WEI) {
      this.log.warn(
        `computed maxFeePerGas ${max} exceeds safety cap ${SAFETY_MAX_FEE_WEI}; clamping`,
      )
      max = SAFETY_MAX_FEE_WEI
    }

    return { maxFeePerGas: max, maxPriorityFeePerGas: tip }
  }

  /**
   * Fetch the latest block's base fee. Falls back to Arc's protocol
   * minimum if the RPC doesn't return one (older block API surfaces
   * pre-EIP-1559 chains; not expected on Arc but defensive).
   */
  private async fetchBaseFee(): Promise<bigint> {
    try {
      const block = await this.chain.client.getBlock({ blockTag: 'latest' })
      return block.baseFeePerGas ?? ARC_MIN_BASE_FEE_WEI
    } catch (err) {
      this.log.warn(`baseFee fetch failed: ${(err as Error).message}; using floor`)
      return ARC_MIN_BASE_FEE_WEI
    }
  }
}

// Test-only exports — re-exported so unit tests can assert against the
// known constants without duplicating them.
export const __testing__ = {
  ARC_MIN_BASE_FEE_WEI,
  SAFETY_MAX_FEE_WEI,
}
