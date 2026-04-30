import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import { SubscriptionLapsedService } from './subscription-lapsed.service.js'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.webhookDelivery })],
  providers: [SubscriptionLapsedService],
  exports: [SubscriptionLapsedService],
})
export class SubscriptionLapsedModule {}
