import { Module } from '@nestjs/common'

import { PayerNotificationsService } from './payer-notifications.service.js'

@Module({
  providers: [PayerNotificationsService],
  exports: [PayerNotificationsService],
})
export class PayerNotificationsModule {}
