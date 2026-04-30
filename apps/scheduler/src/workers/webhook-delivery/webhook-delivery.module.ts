import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import { WebhookDeliveryWorker } from './webhook-delivery.worker.js'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.webhookDelivery })],
  providers: [WebhookDeliveryWorker],
})
export class WebhookDeliveryModule {}
