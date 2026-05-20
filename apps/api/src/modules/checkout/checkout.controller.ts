import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { PaymentSession, SubscriptionPlan } from '@strimz/shared-types'

import { Public } from '../../common/decorators/public.decorator.js'
import { PaymentSessionsService } from '../payment-sessions/payment-sessions.service.js'
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service.js'

/**
 * Public checkout endpoints — what the hosted-checkout browser bundle
 * calls before it can sign anything.
 *
 *   GET /v1/checkout/sessions/:id   load a payment session payload
 *   GET /v1/checkout/plans/:id      load a subscription plan payload
 *
 * No authentication: both records describe what a merchant is asking
 * a payer to authorise, which is intrinsically public information.
 * The id-as-handle convention is what the merchant's checkout URL
 * already exposes (`/pay/:id`, `/sub/:id`), so no opacity is being
 * traded here — a leaked URL was always sufficient to view the
 * checkout terms.
 *
 * Lives in its own module rather than as a `@Public()`-decorated
 * route inside the payment-sessions / subscription-plans modules so
 * the merchant-scoped surface (which is the merchant-dashboard
 * contract) stays cleanly separated from the payer-facing surface
 * (which is the hosted-checkout contract).
 */
@ApiTags('checkout')
@Controller('/v1/checkout')
export class CheckoutController {
  constructor(
    private readonly sessions: PaymentSessionsService,
    private readonly plans: SubscriptionPlansService,
  ) {}

  @ApiOperation({
    summary: 'Load a payment session by id (public)',
    description:
      'Returns the same shape as the merchant-scoped retrieve, including ' +
      'chainMerchantId and tokenAddress so the hosted checkout can build the ' +
      'EIP-712 typed-data.',
  })
  @Public()
  @Get('/sessions/:id')
  retrieveSession(@Param('id') id: string): Promise<PaymentSession> {
    return this.sessions.retrievePublic(id)
  }

  @ApiOperation({
    summary: 'Load a subscription plan by id (public)',
    description:
      'Returns the same shape as the merchant-scoped retrieve, including ' +
      'chainMerchantId, tokenAddress, and intervalSeconds so the hosted ' +
      'enrolment page can build the EIP-2612 permit.',
  })
  @Public()
  @Get('/plans/:id')
  retrievePlan(@Param('id') id: string): Promise<SubscriptionPlan> {
    return this.plans.retrievePublic(id)
  }
}
