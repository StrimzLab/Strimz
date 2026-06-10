import { Module } from '@nestjs/common'

import { MerchantNotificationsService } from './merchant-notifications.service.js'

@Module({
  providers: [MerchantNotificationsService],
  exports: [MerchantNotificationsService],
})
export class MerchantNotificationsModule {}
