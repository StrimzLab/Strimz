import { Module } from '@nestjs/common'

import { PaymentSessionsModule } from '../payment-sessions/payment-sessions.module.js'
import { SubscriptionPlansModule } from '../subscription-plans/subscription-plans.module.js'
import { CheckoutController } from './checkout.controller.js'

/**
 * Public hosted-checkout HTTP surface. Re-uses the services from the
 * merchant-scoped modules so there's a single source of truth for
 * the read path; only the auth posture and the controller wrapper
 * differ.
 */
@Module({
  imports: [PaymentSessionsModule, SubscriptionPlansModule],
  controllers: [CheckoutController],
})
export class CheckoutModule {}
