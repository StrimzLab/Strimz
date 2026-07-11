import { Module } from '@nestjs/common'

import { CustomersModule } from '../customers/customers.module.js'
import { MerchantsModule } from '../merchants/merchants.module.js'
import { PaymentSessionsModule } from '../payment-sessions/payment-sessions.module.js'
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module.js'
import { CheckoutController } from './checkout.controller.js'

@Module({
  imports: [PaymentSessionsModule, SubscriptionPlansModule, CustomersModule, MerchantsModule],
  controllers: [CheckoutController],
})
export class CheckoutModule {}
