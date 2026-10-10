import { Module } from '@nestjs/common'

import { CustomersModule } from '../customers/customers.module.js'
import { MerchantsModule } from '../merchants/merchants.module.js'
import { PaymentSessionsModule } from '../payment-sessions/payment-sessions.module.js'
import { RelayModule } from '../relay/relay.module.js'
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module.js'
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js'
import { CheckoutController } from './checkout.controller.js'
import { CheckoutPayerService } from './checkout-payer.service.js'

@Module({
  imports: [
    PaymentSessionsModule,
    SubscriptionPlansModule,
    CustomersModule,
    MerchantsModule,
    SubscriptionsModule,
    RelayModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutPayerService],
})
export class CheckoutModule {}
