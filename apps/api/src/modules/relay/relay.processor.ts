import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { Worker, type Job } from 'bullmq'
import { hexToBigInt } from 'viem'

import { ChainService } from '../../infra/chain/chain.service.js'
import { KMS_SIGNER } from '../../infra/kms/kms.tokens.js'
import type { KmsSigner } from '../../infra/kms/kms.types.js'
import { toKmsAccount } from '../../infra/kms/kms-account.js'
import { QUEUE_NAMES } from '../../infra/queue/queue.service.js'
import { RedisService } from '../../infra/redis/redis.service.js'
import { GasPricingService } from './gas-pricing.service.js'
import { NonceManager } from './nonce-manager.service.js'
import type { RelayJobData } from './relay.types.js'

/**
 * Result returned to BullMQ. On success contains the tx hash + block;
 * on failure the worker throws (BullMQ then surfaces the error and
 * applies its retry policy).
 */
export interface RelayJobResult {
  txHash: `0x${string}`
  blockNumber: string // serialised bigint
  blockHash: `0x${string}`
}

/**
 * BullMQ worker that drives one relay submission end-to-end:
 *   acquire nonce -> compute gas -> sign via KMS -> broadcast -> await receipt.
 *
 * Lives in the API process for v1 to keep the deployment surface
 * small. Concurrency is pinned to 1 because we serve a single hot
 * wallet — nonces must be assigned and consumed strictly in order, and
 * parallel signing against a single nonce counter would surface as
 * "replacement underpriced" errors. When we eventually run a pool of
 * hot wallets, lift concurrency to the pool size and key NonceManager
 * by wallet address (already its shape).
 *
 * Retry policy is set when jobs are enqueued (see RelayService.enqueue).
 * On nonce errors we resync the local counter before the retry; on
 * receipt-revert we record the revert and DO NOT retry (the tx was
 * mined; a retry would just burn more gas without changing the outcome).
 */
@Injectable()
export class RelayProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RelayProcessor.name)
  private worker?: Worker<RelayJobData, RelayJobResult>

  constructor(
    private readonly redis: RedisService,
    private readonly chain: ChainService,
    private readonly nonces: NonceManager,
    private readonly gas: GasPricingService,
    @Inject(KMS_SIGNER) private readonly signer: KmsSigner,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<RelayJobData, RelayJobResult>(
      QUEUE_NAMES.relaySubmission,
      async (job) => this.process(job),
      {
        connection: this.redis.client,
        concurrency: 1,
      },
    )
    this.worker.on('failed', (job, err) => {
      this.log.warn(`relay job ${job?.id} failed: ${err.message}`)
    })
    this.worker.on('completed', (job, result) => {
      this.log.log(`relay job ${job.id} confirmed in tx ${result.txHash}`)
    })
    this.log.log(`relay worker ready (signer=${this.signer.address})`)
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close()
  }

  /**
   * Single-job lifecycle. Each step throws on failure; BullMQ's retry
   * policy decides whether to re-queue. The `attemptsMade` counter on
   * the job is available via `job.attemptsMade`.
   */
  private async process(job: Job<RelayJobData, RelayJobResult>): Promise<RelayJobResult> {
    const data = job.data
    // `PublicClient.chain` is typed as optional. The Arc chain object
    // is always wired in `ChainService` constructor, but TypeScript
    // doesn't know that — assert and fail loudly if it ever isn't.
    const chain = this.chain.client.chain
    if (!chain) {
      throw new Error('relay processor: chain client has no chain bound')
    }
    const chainId = chain.id

    // Acquire a nonce. On any retry, `resync` is called first below
    // so the counter re-anchors to the chain's view.
    if (job.attemptsMade > 0) {
      await this.nonces.resync(chainId, this.signer.address)
    }
    const nonce = await this.nonces.acquire(chainId, this.signer.address)

    // EIP-1559 fee parameters. Bump the priority tip on retry to claw
    // out of any congestion.
    const priorityFeeGwei = 1 + job.attemptsMade
    const { maxFeePerGas, maxPriorityFeePerGas } = await this.gas.compute({ priorityFeeGwei })

    // Sign via the KMS-backed viem account. The account doesn't know
    // (or care) whether the key sits in process memory or an HSM.
    const account = toKmsAccount(this.signer)
    const serialized = await account.signTransaction({
      type: 'eip1559',
      chainId,
      nonce: Number(nonce),
      to: data.toAddress,
      data: data.callData,
      value: 0n,
      gas: hexToBigInt(`0x${BigInt(data.gasLimit).toString(16)}`),
      maxFeePerGas,
      maxPriorityFeePerGas,
    })

    // Broadcast. viem's `sendRawTransaction` accepts the signed RLP.
    const txHash = await this.chain.client.sendRawTransaction({
      serializedTransaction: serialized,
    })
    this.log.log(
      `relay job ${job.id} broadcast tx=${txHash} nonce=${nonce} maxFee=${maxFeePerGas} tip=${maxPriorityFeePerGas}`,
    )

    // Wait for inclusion. Arc's <1s finality means this resolves
    // quickly; we set a generous timeout so an RPC blip doesn't fail
    // an otherwise-fine tx.
    const receipt = await this.chain.client.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
      pollingInterval: 500,
    })
    if (receipt.status !== 'success') {
      // The tx mined but reverted. BullMQ retry would just re-broadcast
      // the same calldata and revert again. Mark and fail without retry.
      throw new RelayPermanentError(`tx ${txHash} reverted in block ${receipt.blockNumber}`)
    }
    return {
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      blockHash: receipt.blockHash,
    }
  }
}

/**
 * Marker error: BullMQ retries every throw by default. Workers throw
 * `RelayPermanentError` to signal "do not retry, this will fail again."
 * The wiring in RelayService configures `removeOnFail` so permanent
 * failures don't accumulate in Redis.
 */
export class RelayPermanentError extends Error {
  readonly permanent = true
  constructor(message: string) {
    super(message)
    this.name = 'RelayPermanentError'
  }
}
