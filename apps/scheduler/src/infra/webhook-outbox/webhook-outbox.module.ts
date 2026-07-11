import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '../queue/queue-names.js'
import { WebhookOutboxService } from './webhook-outbox.service.js'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.webhookDelivery })],
  providers: [WebhookOutboxService],
})
export class WebhookOutboxModule {}
