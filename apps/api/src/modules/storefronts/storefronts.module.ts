import { Module } from '@nestjs/common'
import { PaymentSessionsModule } from '../payment-sessions/payment-sessions.module.js'
import { StorefrontsController } from './storefronts.controller.js'
import { StorefrontsService } from './storefronts.service.js'

@Module({
  imports: [PaymentSessionsModule],
  controllers: [StorefrontsController],
  providers: [StorefrontsService],
  exports: [StorefrontsService],
})
export class StorefrontsModule {}
