import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { WebhookRecoveryService } from './webhook-recovery.service.js'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.webhookDelivery })],
  providers: [WebhookRecoveryService],
  exports: [WebhookRecoveryService],
})
export class WebhookRecoveryModule {}
