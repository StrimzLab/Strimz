import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { erc20Abi, TransactionReceiptNotFoundError, type Hex } from 'viem'

import { ChainService } from '../../infra/chain/chain.service.js'
import { KMS_SIGNER } from '../../infra/kms/kms.tokens.js'
import type { KmsSigner } from '../../infra/kms/kms.types.js'
import { revertReasonOf } from './relay-revert.js'

export type RelayReceiptStatus = 'success' | 'reverted'

@Injectable()
export class RelayChainProbe {
  constructor(
    private readonly chain: ChainService,
    @Inject(KMS_SIGNER) private readonly signer: KmsSigner,
  ) {}

  async simulate(call: { to: Hex; data: Hex }): Promise<void> {
    await this.chain.client
      .call({ account: this.signer.address, to: call.to, data: call.data, blockTag: 'latest' })
      .catch((err: unknown) => {
        const revert = revertReasonOf(err)
        if (revert === null) throw err
        throw new BadRequestException({
          code: 'relay_simulation_failed',
          message: `the signed call reverts on-chain: ${revert}`,
          details: { revert },
        })
      })
  }

  async receiptStatus(txHash: Hex): Promise<RelayReceiptStatus | null> {
    const receipt = await this.chain.client
      .getTransactionReceipt({ hash: txHash })
      .catch((err: unknown) => {
        if (err instanceof TransactionReceiptNotFoundError) return null
        throw err
      })
    return receipt ? receipt.status : null
  }

  balanceOf(token: Hex, owner: Hex): Promise<bigint> {
    return this.chain.client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    })
  }

  async latestBlockTimestamp(): Promise<bigint> {
    const block = await this.chain.client.getBlock({ blockTag: 'latest' })
    return block.timestamp
  }
}
