/**
 * Recording in-memory queue. Replaces the real BullMQ-backed `QueueService`
 * during tests, captures every `add()` call, and exposes accessors so a spec
 * can assert "X jobs landed on Y queue."
 */
export interface RecordedJob {
  queue: string
  name: string
  data: unknown
  opts: unknown
}

import {
  agentActionJobSchema,
  QUEUE_NAMES,
  webhookDeliveryJobSchema,
  type AgentActionJob,
  type WebhookDeliveryJob,
} from '@strimz/queue-contracts'
import type { QueueService } from '../../../src/infra/queue/queue.service.js'

export class StubQueueService implements Pick<
  QueueService,
  'addAgentAction' | 'addWebhookDelivery' | 'onModuleDestroy'
> {
  public readonly recorded: RecordedJob[] = []

  queue(queueName: string) {
    return {
      add: (name: string, data: unknown, opts?: unknown) => {
        this.recorded.push({ queue: queueName, name, data, opts })
        return Promise.resolve({ id: String(this.recorded.length) })
      },
    }
  }

  async addAgentAction(job: AgentActionJob): Promise<void> {
    const parsed = agentActionJobSchema.parse(job)
    await this.queue(QUEUE_NAMES.agentAction).add(parsed.type, parsed)
  }

  async addWebhookDelivery(job: WebhookDeliveryJob): Promise<void> {
    const parsed = webhookDeliveryJobSchema.parse(job)
    await this.queue(QUEUE_NAMES.webhookDelivery).add('deliver', parsed)
  }

  reset() {
    this.recorded.length = 0
  }

  jobsFor(queueName: string): RecordedJob[] {
    return this.recorded.filter((j) => j.queue === queueName)
  }

  async onModuleDestroy() {
    /* no-op */
  }
}
