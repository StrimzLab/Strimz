import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import type { SubscriptionDueJob } from '../../infra/queue/job-payloads.js'

/**
 * Cron-driven sweeper. Every tick:
 *
 *   1. Find at most `SUBSCRIPTION_SWEEP_LIMIT` subscriptions that:
 *      - have `status IN ('active', 'at_risk')`
 *      - have `nextChargeAt <= now`
 *      - are not currently locked (`chargeLock=false`)
 *   2. Atomically acquire `chargeLock` on each (UPDATE … WHERE chargeLock=false).
 *      The conditional UPDATE is what makes multi-instance safe —
 *      whichever scheduler row updates `chargeLock=true` first gets the
 *      job; the others see 0 rows updated and skip.
 *   3. Enqueue one job per acquired subscription onto
 *      `strimz.subscription.due`. The worker calls `batchCharge` and
 *      releases the lock.
 *
 * The cron expression is configurable via `SUBSCRIPTION_SWEEPER_CRON` so
 * test environments can run it on a faster cadence.
 */
@Injectable()
export class SubscriptionSweeperService {
  private readonly log = new Logger(SubscriptionSweeperService.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.subscriptionDue)
    private readonly queue: Queue<SubscriptionDueJob>,
    private readonly cfg: TypedConfigService,
  ) {}

  /**
   * Default cadence: every 15 minutes. Real charging cadence is per-
   * subscription (`nextChargeAt`); this is just how often we *check*.
   */
  @Cron(process.env.SUBSCRIPTION_SWEEPER_CRON || '0 */15 * * * *', {
    name: 'subscription-sweeper',
  })
  async sweep(): Promise<{ enqueued: number }> {
    return this.sweepNow()
  }

  /**
   * Exposed so e2e tests and the HTTP debug endpoint can step the sweeper
   * deterministically without waiting for cron.
   */
  async sweepNow(): Promise<{ enqueued: number }> {
    const limit = this.cfg.env.SUBSCRIPTION_SWEEP_LIMIT
    const now = new Date()

    // Step 1+2: atomic select-and-lock. We do this with a single UPDATE
    // that returns the rows it locked, so two scheduler replicas never
    // see the same subscription as available.
    const candidates = (await this.prisma.db.$queryRawUnsafe(
      `
      UPDATE "Subscription"
         SET "chargeLock" = true,
             "chargeLockAcquiredAt" = NOW()
       WHERE id IN (
         SELECT id FROM "Subscription"
          WHERE "chargeLock" = false
            AND "nextChargeAt" IS NOT NULL
            AND "nextChargeAt" <= $1
            AND status IN ('active'::"SubscriptionStatus", 'at_risk'::"SubscriptionStatus")
            AND "onchainSubscriptionId" IS NOT NULL
          ORDER BY "nextChargeAt" ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       RETURNING id
    `,
      now,
      limit,
    )) as Array<{ id: string }>

    if (candidates.length === 0) {
      this.log.debug('sweeper found nothing due')
      return { enqueued: 0 }
    }

    // Step 3: enqueue one job per candidate.
    await Promise.all(
      candidates.map((c) =>
        this.queue.add(
          'charge',
          { subscriptionId: c.id },
          { removeOnComplete: 1_000, removeOnFail: 1_000 },
        ),
      ),
    )

    this.log.log(`sweeper enqueued ${candidates.length} due subscriptions`)
    return { enqueued: candidates.length }
  }
}
