import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { Worker } from 'bullmq'
import type { RelayJob } from '@strimz/queue-contracts'

import { QUEUE_NAMES } from '../../infra/queue/queue.service.js'
import { RedisService } from '../../infra/redis/redis.service.js'
import { RelayJobRunner, type RelayJobResult } from './relay-job-runner.js'

export { RelayPermanentError, type RelayJobResult } from './relay-job-runner.js'

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
  private worker?: Worker<RelayJob, RelayJobResult>

  constructor(
    private readonly redis: RedisService,
    private readonly runner: RelayJobRunner,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<RelayJob, RelayJobResult>(
      QUEUE_NAMES.relaySubmission,
      (job) => this.runner.run(job),
      {
        connection: this.redis.client,
        concurrency: 1,
      },
    )
    this.worker.on('failed', (job, err) => {
      this.log.warn(`relay job ${job?.id} failed: ${err.message}`)
    })
    this.worker.on('completed', (job, result) => {
      this.log.log(
        'txHash' in result
          ? `relay job ${job.id} confirmed in tx ${result.txHash}`
          : `relay job ${job.id} skipped: ${result.skipped}`,
      )
    })
    this.log.log('relay worker ready')
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close()
  }
}
