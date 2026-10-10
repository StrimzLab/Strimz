import { Inject, Injectable, Logger } from '@nestjs/common'
import { UnrecoverableError } from 'bullmq'
import {
  keccak256,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  type Hex,
  type TransactionReceipt,
} from 'viem'
import { relayJobSchema, type RelayJob } from '@strimz/queue-contracts'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { KMS_SIGNER } from '../../infra/kms/kms.tokens.js'
import type { KmsSigner } from '../../infra/kms/kms.types.js'
import { toKmsAccount } from '../../infra/kms/kms-account.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import {
  decodeMerchantRegisteredId,
  REGISTER_MERCHANT_GAS_LIMIT,
  registerMerchantCallData,
  registrationGaps,
} from '../merchants/registration.js'
import { GasPricingService } from './gas-pricing.service.js'
import { RelayBudgetService } from './relay-budget.service.js'
import { NonceManager } from './nonce-manager.service.js'

export interface RelayJobHandle {
  readonly id?: string
  readonly attemptsMade: number
  readonly data: RelayJob
  updateData(data: RelayJob): Promise<void>
}

export type RelayJobResult =
  | { txHash: Hex; blockNumber: string; blockHash: Hex }
  | { skipped: 'already_registered'; onchainMerchantId: string }

interface RelayCall {
  to: Hex
  data: Hex
  gas: bigint
}

export class RelayPermanentError extends UnrecoverableError {
  readonly permanent = true
  constructor(message: string) {
    super(message)
    this.name = 'RelayPermanentError'
  }
}

@Injectable()
export class RelayJobRunner {
  private readonly log = new Logger(RelayJobRunner.name)
  private readonly registryAddress: Hex

  constructor(
    private readonly chain: ChainService,
    private readonly nonces: NonceManager,
    private readonly gas: GasPricingService,
    private readonly prisma: PrismaService,
    @Inject(KMS_SIGNER) private readonly signer: KmsSigner,
    cfg: TypedConfigService,
    private readonly budget: RelayBudgetService,
  ) {
    const registry = cfg.env.STRIMZ_REGISTRY_ADDRESS
    if (!registry) {
      throw new Error('STRIMZ_REGISTRY_ADDRESS not configured')
    }
    this.registryAddress = registry as Hex
  }

  async run(job: RelayJobHandle): Promise<RelayJobResult> {
    const data = relayJobSchema.parse(job.data)
    if (data.reason === 'registerMerchant') {
      return this.runRegistration(job, data)
    }

    const receipt = await this.broadcastOnce(job, data, {
      to: data.toAddress,
      data: data.callData,
      gas: BigInt(data.gasLimit),
    })
    if (data.merchantInternalId) {
      await this.budget.recordGas(
        data.merchantInternalId,
        receipt.gasUsed * receipt.effectiveGasPrice,
      )
    }

    // Stamp the session as submitted so the dashboard reflects the
    // payment seconds after mining. The indexer completes the flip to
    // confirmed (and sets payerWalletAddress) when it projects the event.
    if (data.sessionId) {
      await this.prisma.db.paymentSession
        .updateMany({
          where: { id: data.sessionId, status: { in: ['created', 'awaiting_payment'] } },
          data: { status: 'submitted', onchainTxHash: receipt.transactionHash },
        })
        .catch((err) => this.log.warn(`session stamp failed for ${data.sessionId}: ${err}`))
    }

    return resultOf(receipt)
  }

  private async runRegistration(
    job: RelayJobHandle,
    data: Extract<RelayJob, { reason: 'registerMerchant' }>,
  ): Promise<RelayJobResult> {
    const merchantId = data.merchantInternalId
    const merchant = await this.prisma.db.merchant.findUnique({
      where: { id: merchantId },
      select: {
        walletAddress: true,
        payoutAddress: true,
        onboardingCompleted: true,
        onchainMerchantId: true,
        onchainRegistrationTxHash: true,
      },
    })
    if (!merchant) {
      throw new RelayPermanentError(`merchant ${merchantId} not found`)
    }
    if (merchant.onchainMerchantId !== null) {
      return {
        skipped: 'already_registered',
        onchainMerchantId: String(merchant.onchainMerchantId),
      }
    }

    if (!data.broadcast && merchant.onchainRegistrationTxHash) {
      const earlier = await this.settledReceipt(merchant.onchainRegistrationTxHash as Hex)
      if (earlier?.status === 'success') {
        return this.linkRegistration(merchantId, earlier)
      }
    }

    const missing = registrationGaps(merchant)
    if (missing.length > 0) {
      throw new RelayPermanentError(
        `merchant ${merchantId} cannot register on-chain, missing: ${missing.join(', ')}`,
      )
    }

    const receipt = await this.broadcastOnce(
      job,
      data,
      {
        to: this.registryAddress,
        data: registerMerchantCallData(merchant),
        gas: REGISTER_MERCHANT_GAS_LIMIT,
      },
      async (txHash) => {
        await this.prisma.db.merchant.update({
          where: { id: merchantId },
          data: { onchainRegistrationTxHash: txHash },
        })
      },
    )
    return this.linkRegistration(merchantId, receipt)
  }

  private async linkRegistration(
    merchantId: string,
    receipt: TransactionReceipt,
  ): Promise<RelayJobResult> {
    const onchainId = decodeMerchantRegisteredId(receipt, this.registryAddress)
    await this.prisma.db.merchant.updateMany({
      where: { id: merchantId, onchainMerchantId: null },
      data: { onchainMerchantId: Number(onchainId) },
    })
    this.log.log(
      `merchant ${merchantId} registered on-chain as id=${onchainId} in tx ${receipt.transactionHash}`,
    )
    return resultOf(receipt)
  }

  private async broadcastOnce(
    job: RelayJobHandle,
    data: RelayJob,
    call: RelayCall,
    onRecorded?: (txHash: Hex) => Promise<void>,
  ): Promise<TransactionReceipt> {
    const chainId = this.chainId()
    let nonce: bigint

    if (data.broadcast) {
      const settled = await this.settledReceipt(data.broadcast.txHash)
      if (settled) return this.requireSuccess(settled)

      const recordedNonce = BigInt(data.broadcast.nonce)
      const confirmed = BigInt(
        await this.chain.client.getTransactionCount({
          address: this.signer.address,
          blockTag: 'latest',
        }),
      )
      if (confirmed <= recordedNonce) {
        nonce = recordedNonce
      } else {
        await this.nonces.resync(chainId, this.signer.address)
        nonce = await this.nonces.acquire(chainId, this.signer.address)
      }
    } else {
      if (job.attemptsMade > 0) {
        await this.nonces.resync(chainId, this.signer.address)
      }
      nonce = await this.nonces.acquire(chainId, this.signer.address)
    }

    const { maxFeePerGas, maxPriorityFeePerGas } = await this.gas.compute({
      priorityFeeGwei: 1 + job.attemptsMade,
    })
    const serialized = await toKmsAccount(this.signer).signTransaction({
      type: 'eip1559',
      chainId,
      nonce: Number(nonce),
      to: call.to,
      data: call.data,
      value: 0n,
      gas: call.gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
    })
    const txHash = keccak256(serialized)

    await job.updateData({ ...data, broadcast: { txHash, nonce: nonce.toString() } })
    await onRecorded?.(txHash)

    await this.chain.client.sendRawTransaction({ serializedTransaction: serialized })
    this.log.log(
      `relay job ${job.id} broadcast tx=${txHash} nonce=${nonce} maxFee=${maxFeePerGas} tip=${maxPriorityFeePerGas}`,
    )

    const receipt = await this.chain.client.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
      pollingInterval: 500,
    })
    return this.requireSuccess(receipt)
  }

  private async settledReceipt(hash: Hex): Promise<TransactionReceipt | null> {
    const receipt = await this.chain.client
      .getTransactionReceipt({ hash })
      .catch((err: unknown) => {
        if (err instanceof TransactionReceiptNotFoundError) return null
        throw err
      })
    if (receipt) return receipt

    const known = await this.chain.client
      .getTransaction({ hash })
      .then(() => true)
      .catch((err: unknown) => {
        if (err instanceof TransactionNotFoundError) return false
        throw err
      })
    if (!known) return null

    return this.chain.client.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
      pollingInterval: 500,
    })
  }

  private requireSuccess(receipt: TransactionReceipt): TransactionReceipt {
    if (receipt.status !== 'success') {
      throw new RelayPermanentError(
        `tx ${receipt.transactionHash} reverted in block ${receipt.blockNumber}`,
      )
    }
    return receipt
  }

  private chainId(): number {
    const chain = this.chain.client.chain
    if (!chain) {
      throw new Error('relay processor: chain client has no chain bound')
    }
    return chain.id
  }
}

function resultOf(receipt: TransactionReceipt): RelayJobResult {
  return {
    txHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    blockHash: receipt.blockHash,
  }
}
