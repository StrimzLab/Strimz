import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { Queue } from 'bullmq'
import {
  agentActionJobSchema,
  QUEUE_NAMES,
  relayJobSchema,
  webhookDeliveryJobSchema,
  type AgentActionJob,
  type QueueName,
  type RelayJob,
  type WebhookDeliveryJob,
} from '@strimz/queue-contracts'
import { RedisService } from '../redis/redis.service.js'

export { QUEUE_NAMES, type QueueName }

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

  async addAgentAction(job: AgentActionJob): Promise<void> {
    const parsed = agentActionJobSchema.parse(job)
    await this.queue(QUEUE_NAMES.agentAction).add(parsed.type, parsed)
  }

  async addWebhookDelivery(job: WebhookDeliveryJob): Promise<void> {
    const parsed = webhookDeliveryJobSchema.parse(job)
    await this.queue(QUEUE_NAMES.webhookDelivery).add('deliver', parsed)
  }

  async addRelaySubmission(job: RelayJob): Promise<void> {
    const parsed = relayJobSchema.parse(job)
    await this.queue(QUEUE_NAMES.relaySubmission).add(`relay:${parsed.reason}`, parsed, {
      jobId: parsed.idempotencyKey,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 3600 },
    })
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.close()))
  }
}
