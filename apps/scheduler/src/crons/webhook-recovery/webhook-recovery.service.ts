import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'

const STRANDED_AFTER_MS = 2 * 60_000
const MAX_AGE_MS = 7 * 24 * 60 * 60_000
const BATCH = 200

/**
 * Re-enqueues deliveries that got stranded — a crash between the DB
 * status write and the BullMQ enqueue, or a retry whose delay job was
 * lost. Finds `pending`/`retrying` rows whose next attempt is overdue
 * and pushes them back onto the delivery queue. The worker's terminal
 * guard + `X-Strimz-Delivery-Id` dedupe make re-enqueue safe.
 */
@Injectable()
export class WebhookRecoveryService {
  private readonly log = new Logger(WebhookRecoveryService.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.webhookDelivery)
    private readonly deliveryQueue: Queue,
  ) {}

  @Cron(process.env.WEBHOOK_RECOVERY_CRON || '30 * * * * *', { name: 'webhook-recovery' })
  async sweep(): Promise<{ requeued: number }> {
    return this.sweepNow()
  }

  async sweepNow(): Promise<{ requeued: number }> {
    const cutoff = new Date(Date.now() - STRANDED_AFTER_MS)
    const minCreated = new Date(Date.now() - MAX_AGE_MS)
    const stranded = await this.prisma.db.webhookDelivery.findMany({
      where: {
        status: { in: ['pending', 'retrying'] },
        createdAt: { gt: minCreated },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lt: cutoff } }],
      },
      take: BATCH,
      include: { endpoint: true },
    })

    let requeued = 0
    for (const d of stranded) {
      // Bump nextAttemptAt so the next sweep doesn't immediately re-grab.
      await this.prisma.db.webhookDelivery.update({
        where: { id: d.id },
        data: { nextAttemptAt: new Date(Date.now() + STRANDED_AFTER_MS) },
      })
      await this.deliveryQueue.add(
        'deliver',
        {
          deliveryId: d.deliveryId,
          endpointId: d.endpointId,
          url: d.endpoint.url,
          signingSecretHash: d.endpoint.signingSecretHash,
          eventId: d.eventId,
        },
        { attempts: 1, removeOnComplete: 1_000, removeOnFail: 1_000 },
      )
      requeued++
    }

    if (requeued > 0) this.log.warn(`re-enqueued ${requeued} stranded deliveries`)
    return { requeued }
  }
}
