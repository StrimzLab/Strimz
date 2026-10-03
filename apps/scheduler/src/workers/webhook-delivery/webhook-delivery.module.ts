import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { WebhookTransportModule } from '../../infra/webhook-transport/webhook-transport.module.js'
import { WebhookDeliveryWorker } from './webhook-delivery.worker.js'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.webhookDelivery }),
    WebhookTransportModule,
  ],
  providers: [WebhookDeliveryWorker],
})
export class WebhookDeliveryModule {}
