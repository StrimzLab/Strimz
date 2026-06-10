import { Module } from '@nestjs/common'

import { SubscriptionPlansController } from './subscription-plans.controller.js'
import { SubscriptionPlansService } from './subscription-plans.service.js'
import { MerchantsModule } from '../merchants/merchants.module.js'

@Module({
  imports: [MerchantsModule],
  controllers: [SubscriptionPlansController],
  providers: [SubscriptionPlansService],
  exports: [SubscriptionPlansService],
})
export class SubscriptionPlansModule {}
