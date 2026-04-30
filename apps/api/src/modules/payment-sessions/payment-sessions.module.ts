import { Module } from '@nestjs/common'
import { PaymentSessionsController } from './payment-sessions.controller.js'
import { PaymentSessionsService } from './payment-sessions.service.js'

@Module({
  controllers: [PaymentSessionsController],
  providers: [PaymentSessionsService],
  exports: [PaymentSessionsService],
})
export class PaymentSessionsModule {}
