import { Module } from '@nestjs/common'
import { SubscriptionPlansController } from './subscription-plans.controller.js'
import { SubscriptionPlansService } from './subscription-plans.service.js'

@Module({
  controllers: [SubscriptionPlansController],
  providers: [SubscriptionPlansService],
  exports: [SubscriptionPlansService],
})
export class SubscriptionPlansModule {}
