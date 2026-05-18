import { Injectable, Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { encodeFunctionData, padHex } from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { QUEUE_NAMES, QueueService } from '../../infra/queue/queue.service.js'
import { payWithAuthorizationAbi, permitAndCreateSubscriptionAbi } from './abi.js'
import type { RelayJobResult } from './relay.processor.js'
import type {
  PayWithAuthorizationInput,
  PermitAndCreateSubscriptionInput,
  RelayJobData,
  RelaySubmissionStatus,
  RelaySubmissionView,
} from './relay.types.js'

/**
 * Default gas limits chosen with ~30% headroom over typical observed
 * gas usage in Foundry tests. The actual estimation could be done at
 * submission time via `estimateGas`, but pre-baked limits avoid an
 * extra RPC round-trip on the hot path and give predictable cost
 * accounting for the relay subsidy.
 */
const GAS_LIMITS = {
  payWithAuthorization: 280_000n,
  permitAndCreateSubscription: 320_000n,
} as const

/**
 * Public surface of the meta-tx relay layer. Other modules
 * (payment-sessions, subscriptions) call this service to submit a
 * payer-signed authorization on-chain without exposing the merchant
 * (or anyone else) to gas management.
 *
 * Idempotency: every submission carries an `idempotencyKey` (typically
 * the upstream session id or a UUID minted at session creation).
 * Resubmitting the same key returns the existing job's state rather
 * than enqueueing a duplicate — so a flaky client retrying a `/submit`
 * call does not produce two on-chain txs.
 *
 * Submission state is stored in BullMQ. For v1 this means up to
 * `removeOnComplete.age` seconds of history is queryable; longer
 * retention will land when the Prisma `RelaySubmission` model is
 * introduced.
 */
@Injectable()
export class RelayService {
  private readonly log = new Logger(RelayService.name)
  private readonly paymentsAddress: `0x${string}` | undefined
  private readonly subscriptionsAddress: `0x${string}` | undefined

  constructor(
    private readonly queue: QueueService,
    cfg: TypedConfigService,
  ) {
    this.paymentsAddress = cfg.env.STRIMZ_PAYMENTS_ADDRESS as `0x${string}` | undefined
    this.subscriptionsAddress = cfg.env.STRIMZ_SUBSCRIPTIONS_ADDRESS as `0x${string}` | undefined
  }

  // ----- Public submission entrypoints -----

  async submitPayWithAuthorization(
    input: PayWithAuthorizationInput,
  ): Promise<RelaySubmissionView> {
    if (!this.paymentsAddress) {
      throw new Error('STRIMZ_PAYMENTS_ADDRESS is not configured')
    }
    const callData = encodeFunctionData({
      abi: payWithAuthorizationAbi,
      functionName: 'payWithAuthorization',
      args: [
        input.merchantId,
        input.token,
        {
          from: input.auth.from,
          amount: input.auth.amount,
          validAfter: input.auth.validAfter,
          validBefore: input.auth.validBefore,
          nonce: input.auth.nonce,
        },
        input.ref,
        input.signature.v,
        input.signature.r,
        input.signature.s,
      ],
    })
    return this.enqueue({
      idempotencyKey: input.idempotencyKey,
      reason: 'payWithAuthorization',
      toAddress: this.paymentsAddress,
      callData,
      gasLimit: GAS_LIMITS.payWithAuthorization.toString(),
      merchantInternalId: input.merchantInternalId,
      sessionId: input.sessionId,
    })
  }

  async submitPermitAndCreateSubscription(
    input: PermitAndCreateSubscriptionInput,
  ): Promise<RelaySubmissionView> {
    if (!this.subscriptionsAddress) {
      throw new Error('STRIMZ_SUBSCRIPTIONS_ADDRESS is not configured')
    }
    const callData = encodeFunctionData({
      abi: permitAndCreateSubscriptionAbi,
      functionName: 'permitAndCreateSubscription',
      args: [
        input.merchantId,
        input.token,
        input.amount,
        input.interval,
        input.startAt,
        input.endAt,
        {
          owner: input.permitData.owner,
          value: input.permitData.value,
          deadline: input.permitData.deadline,
        },
        input.signature.v,
        input.signature.r,
        input.signature.s,
      ],
    })
    return this.enqueue({
      idempotencyKey: input.idempotencyKey,
      reason: 'permitAndCreateSubscription',
      toAddress: this.subscriptionsAddress,
      callData,
      gasLimit: GAS_LIMITS.permitAndCreateSubscription.toString(),
      merchantInternalId: input.merchantInternalId,
      subscriptionInternalId: input.subscriptionInternalId,
    })
  }

  /**
   * Look up a previously enqueued submission by its idempotency key.
   * Returns `null` if no job is found (i.e. it was never submitted,
   * or it completed long enough ago that BullMQ aged it out).
   */
  async getByIdempotencyKey(idempotencyKey: string): Promise<RelaySubmissionView | null> {
    const queue = this.queue.queue(QUEUE_NAMES.relaySubmission)
    const job = await queue.getJob(idempotencyKey)
    if (!job) return null
    return this.viewFromJob(job)
  }

  // ----- Internal -----

  private async enqueue(data: RelayJobData): Promise<RelaySubmissionView> {
    const queue = this.queue.queue(QUEUE_NAMES.relaySubmission)
    // Using the idempotency key as the BullMQ job id makes
    // resubmission a no-op: BullMQ rejects duplicate ids with a
    // documented `Job <id> already exists` shape. We catch that and
    // return the existing job's view rather than failing the caller.
    let job: Job<RelayJobData, RelayJobResult>
    try {
      job = (await queue.add(`relay:${data.reason}`, data, {
        jobId: data.idempotencyKey,
        // Up to 5 attempts; exponential backoff starting at 2s capped
        // at 30s. On nonce / underpriced errors the worker resyncs
        // before each retry.
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        // Keep completed/failed history for an hour for dashboard
        // queries. The Prisma model will eventually replace this with
        // unbounded retention.
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 3600 },
      })) as Job<RelayJobData, RelayJobResult>
    } catch (err) {
      const existing = await queue.getJob(data.idempotencyKey)
      if (existing) {
        this.log.log(`relay submission ${data.idempotencyKey} replayed (idempotent)`)
        return this.viewFromJob(existing)
      }
      throw err
    }
    this.log.log(
      `relay submission ${job.id} enqueued (reason=${data.reason}, gasLimit=${data.gasLimit})`,
    )
    return this.viewFromJob(job)
  }

  private async viewFromJob(
    job: Job<RelayJobData, RelayJobResult>,
  ): Promise<RelaySubmissionView> {
    const state = await job.getState()
    return {
      id: String(job.id),
      idempotencyKey: job.data.idempotencyKey,
      status: mapStatus(state),
      txHash: job.returnvalue?.txHash ?? null,
      reason: job.data.reason,
      errorReason: job.failedReason ?? null,
      attemptCount: job.attemptsMade,
      enqueuedAt: new Date(job.timestamp).toISOString(),
    }
  }
}

function mapStatus(state: string): RelaySubmissionStatus {
  // BullMQ states: waiting | active | delayed | completed | failed | paused | waiting-children | unknown
  switch (state) {
    case 'completed':
      return 'confirmed'
    case 'failed':
      return 'failed'
    case 'active':
      // The worker is somewhere in [signing -> broadcast -> awaiting receipt].
      // Without per-step granularity we collapse to `signing`; the
      // dashboard surfaces enough by also showing the txHash if set.
      return 'signing'
    case 'delayed':
    case 'waiting':
    case 'waiting-children':
    case 'paused':
    default:
      return 'queued'
  }
}

// Internal exports for tests
export const __testing__ = {
  mapStatus,
  // Re-exported so call sites in tests can construct realistic
  // diagnostic payloads without duplicating the constants.
  GAS_LIMITS,
  padHex, // used in tests when synthesising bytes32 fixtures
}
