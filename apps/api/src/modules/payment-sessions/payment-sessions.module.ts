import { Module } from '@nestjs/common'

import { PaymentSessionsController } from './payment-sessions.controller.js'
import { PaymentSessionsService } from './payment-sessions.service.js'
import { MerchantsModule } from '../merchants/merchants.module.js'

@Module({
  imports: [MerchantsModule],
  controllers: [PaymentSessionsController],
  providers: [PaymentSessionsService],
  exports: [PaymentSessionsService],
})
export class PaymentSessionsModule {}
