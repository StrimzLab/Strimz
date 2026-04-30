import { Logger } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job } from 'bullmq'
import { keccak256, toHex } from 'viem'
import { ChainService } from '../../infra/chain/chain.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import {
  subscriptionDueJobSchema,
  type SubscriptionDueJob,
} from '../../infra/queue/job-payloads.js'

/**
 * Consumes `strimz.subscription.due`. Each job is a single-subscription
 * charge attempt — the sweeper enqueues one per due subscription rather
 * than batching off-chain, so a poison subscription doesn't block its
 * peers.
 *
 * On-chain idempotency is achieved by deriving a deterministic
 * `chargeAttemptId` from `(subscriptionId, currentPeriodEndAt)` —
 * replays of the same period produce the same id; the contract's
 * `isAttemptUsed` check then short-circuits the duplicate.
 *
 * Lock release semantics:
 *   - The sweeper acquires `Subscription.chargeLock` atomically.
 *   - This worker releases it AFTER the tx is broadcast (success) OR
 *     when broadcast fails (so the next sweep tick can retry).
 *
 * The actual on-chain `SubscriptionCharged` / `SubscriptionChargeSkipped`
 * event is projected by the indexer; this worker only cares about
 * getting the tx broadcast.
 */
@Processor(QUEUE_NAMES.subscriptionDue)
export class SubscriptionDueWorker extends WorkerHost {
  private readonly log = new Logger(SubscriptionDueWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
  ) {
    super()
  }

  async process(job: Job<SubscriptionDueJob>): Promise<{ txHash: string; chargeAttemptId: string }> {
    const data = subscriptionDueJobSchema.parse(job.data)
    const sub = await this.prisma.db.subscription.findUniqueOrThrow({
      where: { id: data.subscriptionId },
    })

    if (sub.onchainSubscriptionId == null) {
      // Off-chain row created but never linked by the indexer. Release
      // the lock and skip — the next sweep ignores it until it has an
      // onchain id.
      await this.releaseLock(sub.id)
      throw new Error('subscription has no onchainSubscriptionId — indexer not caught up')
    }
    if (sub.status === 'cancelled' || sub.status === 'lapsed') {
      await this.releaseLock(sub.id)
      return { txHash: '0x0', chargeAttemptId: '0x0' }
    }

    const chargeAttemptId = deriveChargeAttemptId(sub.onchainSubscriptionId, sub.currentPeriodEndAt)

    // Short-circuit: don't broadcast if the contract has already burned
    // this attempt id (e.g. a previous worker's tx landed but the lock
    // wasn't released cleanly).
    const used = await this.chain.isAttemptUsed(chargeAttemptId)
    if (used) {
      this.log.warn(`charge attempt ${chargeAttemptId} already used on-chain — releasing lock only`)
      await this.releaseLock(sub.id)
      return { txHash: '0xused', chargeAttemptId }
    }

    let txHash: `0x${string}`
    try {
      txHash = await this.chain.batchCharge(
        [BigInt(sub.onchainSubscriptionId)],
        [chargeAttemptId],
      )
    } catch (err) {
      // Broadcast failed (RPC error / nonce conflict / chain revert).
      // Release the lock so the next sweep retries.
      await this.releaseLock(sub.id)
      throw err
    }

    await this.releaseLock(sub.id)
    this.log.log(
      `broadcast batchCharge for sub=${sub.id} onchain=${sub.onchainSubscriptionId} tx=${txHash}`,
    )
    return { txHash, chargeAttemptId }
  }

  private async releaseLock(subscriptionId: string): Promise<void> {
    await this.prisma.db.subscription.update({
      where: { id: subscriptionId },
      data: { chargeLock: false, chargeLockAcquiredAt: null },
    })
  }
}

/**
 * Derive a deterministic 32-byte `chargeAttemptId` from a subscription's
 * on-chain id + period end. Replays of the same period yield the same id,
 * so the contract's `usedAttempts[id]` check drops the duplicate.
 */
export function deriveChargeAttemptId(
  onchainSubscriptionId: number,
  periodEndAt: Date,
): `0x${string}` {
  const ts = Math.floor(periodEndAt.getTime() / 1000)
  // bytes32 = keccak256(abi.encodePacked(uint256, uint64))
  // We use the same packed encoding the contract would expect.
  const packed = `0x${onchainSubscriptionId.toString(16).padStart(64, '0')}${ts.toString(16).padStart(16, '0')}`
  return keccak256(toHex(packed)) as `0x${string}`
}
