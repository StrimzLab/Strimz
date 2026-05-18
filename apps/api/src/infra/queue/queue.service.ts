import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { Queue } from 'bullmq'
import { RedisService } from '../redis/redis.service.js'

/**
 * Named BullMQ queues used by the scheduler and agent workers.
 * The API enqueues; workers consume in their own processes.
 */
export const QUEUE_NAMES = {
  webhookDelivery: 'strimz.webhook.delivery',
  subscriptionDue: 'strimz.subscription.due',
  agentAction: 'strimz.agent.action',
  relaySubmission: 'strimz.relay.submission',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly log = new Logger(QueueService.name)
  private readonly queues = new Map<QueueName, Queue>()

  constructor(private readonly redis: RedisService) {}

  queue(name: QueueName): Queue {
    let q = this.queues.get(name)
    if (!q) {
      q = new Queue(name, { connection: this.redis.client })
      this.queues.set(name, q)
      this.log.log(`queue ready: ${name}`)
    }
    return q
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()))
  }
}
