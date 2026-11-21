import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { erc20Abi, parseAbi, TransactionReceiptNotFoundError, type Hex } from 'viem'
import type { KmsSigner } from '@strimz/signer'
import { CANCEL_SUBSCRIPTION_TYPES, VIEW_SUBSCRIPTIONS_TYPES } from '@strimz/sdk/eip712'

import { ChainService } from '../../infra/chain/chain.service.js'
import { KMS_SIGNER } from '../../infra/kms/kms.tokens.js'
import { revertReasonOf } from './relay-revert.js'

export type RelayReceiptStatus = 'success' | 'reverted'

const erc2612NoncesAbi = parseAbi(['function nonces(address owner) view returns (uint256)'])

@Injectable()
export class RelayChainProbe {
  constructor(
    private readonly chain: ChainService,
    @Inject(KMS_SIGNER) private readonly signer: KmsSigner,
  ) {}

  estimateGas(call: { to: Hex; data: Hex }): Promise<bigint> {
    return this.chain.client
      .estimateGas({
        account: this.signer.address,
        to: call.to,
        data: call.data,
        blockTag: 'latest',
      })
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

  permitNonce(token: Hex, owner: Hex): Promise<bigint> {
    return this.chain.client.readContract({
      address: token,
      abi: erc2612NoncesAbi,
      functionName: 'nonces',
      args: [owner],
    })
  }

  balanceOf(token: Hex, owner: Hex): Promise<bigint> {
    return this.chain.client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    })
  }

  // verifyTypedData checks ERC-1271 smart wallets as well as plain keys.
  verifyCancel(input: {
    payer: Hex
    subscriptions: Hex
    subscriptionId: bigint
    deadline: bigint
    signature: Hex
  }): Promise<boolean> {
    return this.chain.client.verifyTypedData({
      address: input.payer,
      domain: {
        name: 'StrimzSubscriptions',
        version: '1',
        chainId: this.chainId(),
        verifyingContract: input.subscriptions,
      },
      types: CANCEL_SUBSCRIPTION_TYPES,
      primaryType: 'CancelSubscription',
      message: { subscriptionId: input.subscriptionId, deadline: input.deadline },
      signature: input.signature,
    })
  }

  verifyViewSubscriptions(input: {
    payer: Hex
    issuedAt: bigint
    signature: Hex
  }): Promise<boolean> {
    return this.chain.client.verifyTypedData({
      address: input.payer,
      domain: { name: 'Strimz', version: '1', chainId: this.chainId() },
      types: VIEW_SUBSCRIPTIONS_TYPES,
      primaryType: 'ViewSubscriptions',
      message: { payer: input.payer, issuedAt: input.issuedAt },
      signature: input.signature,
    })
  }

  async latestBlockTimestamp(): Promise<bigint> {
    const block = await this.chain.client.getBlock({ blockTag: 'latest' })
    return block.timestamp
  }

  private chainId(): number {
    const id = this.chain.client.chain?.id
    if (id === undefined) throw new Error('the Arc client has no chain configured')
    return id
  }
}
