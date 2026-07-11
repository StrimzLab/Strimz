import { Module } from '@nestjs/common'
import { SubscriptionLapsedService } from './subscription-lapsed.service.js'

@Module({
  providers: [SubscriptionLapsedService],
  exports: [SubscriptionLapsedService],
})
export class SubscriptionLapsedModule {}
