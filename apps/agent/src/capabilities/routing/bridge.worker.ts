import { Logger } from '@nestjs/common'
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job, Queue } from 'bullmq'
import { ActivityLogService } from '../../infra/activity-log/activity-log.service.js'
import { CircleAttestationService } from '../../infra/circle-attestation/circle-attestation.service.js'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import {
  cctpBridgeJobSchema,
  type CctpBridgeJob,
  type RoutingSettleAction,
} from '../../infra/queue/job-payloads.js'

/**
 * Consumes `strimz.routing.cctp.bridge`. The producer is the checkout
 * client (`apps/web`) — when a payer pays from a non-Arc chain, the
 * web app records the source-chain burn tx hash and enqueues here.
 *
 * Per job:
 *   1. Record `routing_bridge_initiated` activity (capability=routing).
 *   2. Fetch attestation from Circle's CCTP V2 API.
 *   3. If `pending_confirmations` / `unknown` → re-enqueue with delay
 *      (Circle V2 fast attestation is ~13s; standard ~13min).
 *   4. If `complete` → enqueue `routing.cctp.settle` onto the
 *      scheduler's `strimz.agent.action` queue with the message +
 *      attestation bytes. The scheduler signs `receiveMessage` on Arc.
 *   5. Record `routing_payment_completed` once the settle job is
 *      enqueued.
 *
 * Idempotency: the activity log is keyed on (merchantId, sourceTxHash)
 * so a replay no-ops the bridge initiation; settling is idempotent on
 * the scheduler side because the Arc CCTP `MessageTransmitter` rejects
 * already-received message hashes.
 */
@Processor(QUEUE_NAMES.routingCctpBridge)
export class BridgeWorker extends WorkerHost {
  private readonly log = new Logger(BridgeWorker.name)
  /** Circle V2 fast attestation lands in ~13s; poll on a 30s cadence. */
  private readonly POLL_DELAY_MS = 30_000

  constructor(
    private readonly attestation: CircleAttestationService,
    private readonly activity: ActivityLogService,
    @InjectQueue(QUEUE_NAMES.routingCctpBridge)
    private readonly selfQueue: Queue<CctpBridgeJob>,
    @InjectQueue(QUEUE_NAMES.agentAction)
    private readonly schedulerQueue: Queue<RoutingSettleAction>,
  ) {
    super()
  }

  async process(job: Job<CctpBridgeJob>): Promise<{ status: 'queued' | 'pending'; txHash?: string }> {
    const data = cctpBridgeJobSchema.parse(job.data)

    // First-touch: record bridge_initiated. Subsequent polls (re-enqueued
    // jobs) skip this and just poll attestation.
    if ((job.attemptsMade ?? 0) === 0) {
      await this.activity.record({
        merchantId: data.merchantId,
        capability: 'routing',
        actionType: 'routing_bridge_initiated',
        outcome: 'pending',
        metadata: {
          sourceDomainId: data.sourceDomainId,
          sourceTxHash: data.sourceTxHash,
          ref: data.ref ?? null,
        },
      })
    }

    const result = await this.attestation.fetch({
      sourceDomainId: data.sourceDomainId,
      sourceTxHash: data.sourceTxHash,
    })

    if (result.status !== 'complete') {
      // Re-enqueue ourselves with a delay. BullMQ tracks the attempt
      // count so we can give up after a hard cap if needed.
      await this.selfQueue.add('poll', data, {
        delay: this.POLL_DELAY_MS,
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
      })
      return { status: 'pending' }
    }

    // Attestation ready — hand off to the scheduler for signing.
    const settleJob: RoutingSettleAction = {
      type: 'routing.cctp.settle',
      merchantId: data.merchantId,
      sourceDomainId: data.sourceDomainId,
      sourceTxHash: data.sourceTxHash,
      messageHex: result.messageHex!,
      attestationHex: result.attestationHex!,
      ref: data.ref,
    }
    await this.schedulerQueue.add('settle', settleJob, {
      removeOnComplete: 1_000,
      removeOnFail: 1_000,
    })

    await this.activity.record({
      merchantId: data.merchantId,
      capability: 'routing',
      actionType: 'routing_payment_completed',
      outcome: 'success',
      metadata: {
        sourceDomainId: data.sourceDomainId,
        sourceTxHash: data.sourceTxHash,
        ref: data.ref ?? null,
        stage: 'attestation_ready_settle_enqueued',
      },
    })

    this.log.log(
      `bridge ready: merchant=${data.merchantId} src=${data.sourceTxHash} → enqueued settle`,
    )
    return { status: 'queued' }
  }
}
