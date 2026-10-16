import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { SubscriptionSweeperService } from './subscription-sweeper.service.js'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.subscriptionDue })],
  providers: [SubscriptionSweeperService],
  exports: [SubscriptionSweeperService],
})
export class SubscriptionSweeperModule {}
