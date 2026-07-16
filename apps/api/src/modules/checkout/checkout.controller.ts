import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type {
  MerchantPublicBrand,
  PaymentSession,
  SubscriptionPlan,
  SubscriptionStatusResult,
} from '@strimz/shared-types'

import { Public } from '../../common/decorators/public.decorator.js'
import { CustomersService } from '../customers/customers.service.js'
import { MerchantsService } from '../merchants/merchants.service.js'
import { PaymentSessionsService } from '../payment-sessions/payment-sessions.service.js'
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service.js'
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js'
import { PayerIdentityDto } from './checkout.dto.js'

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
    private readonly customers: CustomersService,
    private readonly merchants: MerchantsService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @ApiOperation({
    summary: 'Load a merchant brand card by id (public)',
    description:
      'Returns businessName, logoUrl, and walletAddress so the hosted ' +
      'checkout can render the merchant identity. Public because the ' +
      'checkout URL already exposes the session/plan tied to this merchant.',
  })
  @Public()
  @Get('/merchants/:id')
  retrieveMerchant(@Param('id') id: string): Promise<MerchantPublicBrand> {
    return this.merchants.getPublicBrand(id)
  }

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

  @ApiOperation({
    summary: 'Check whether a wallet already subscribes to a plan (public)',
    description:
      'The hosted enrolment page calls this once the payer connects a ' +
      'wallet, so it can show "already subscribed" instead of letting them ' +
      'sign a duplicate enrolment. Scoped to (planId, payer): a subscription ' +
      'to a different plan or merchant never matches.',
  })
  @Public()
  @Get('/plans/:id/subscription')
  async planSubscriptionStatus(
    @Param('id') planId: string,
    @Query('payer') payer: string,
  ): Promise<SubscriptionStatusResult> {
    await this.plans.retrievePublic(planId) // 404s on an unknown plan
    return this.subscriptions.activeForPayer(planId, payer ?? '')
  }

  @ApiOperation({
    summary: 'Attach a payer identity to a payment session (public)',
    description:
      'The hosted checkout calls this after the payer connects a wallet ' +
      'and enters an email but before they sign the meta-tx. Upserts a ' +
      'Customer on the merchant keyed by (merchantId, walletAddress), keeps ' +
      'a rolling email history under Customer.metadata.emailHistory, and ' +
      'links the session to the customer so the receipt can find the payer ' +
      'once the on-chain confirmation lands.',
  })
  @Public()
  @Post('/sessions/:id/payer')
  async attachSessionPayer(
    @Param('id') sessionId: string,
    @Body() body: PayerIdentityDto,
  ): Promise<{ customerId: string }> {
    const session = await this.sessions.retrievePublic(sessionId)
    const customer = await this.customers.upsertFromCheckout({
      merchantId: session.merchantId,
      walletAddress: body.walletAddress,
      email: body.email,
    })
    await this.sessions.linkCustomer(sessionId, customer.id)
    return { customerId: customer.id }
  }

  @ApiOperation({
    summary: 'Attach a payer identity to a subscription plan (public)',
    description:
      'Same shape as the session variant, but scoped to a plan. Used by ' +
      'the /sub/:planId page before the payer signs the permit. No ' +
      'subscription row exists yet at this point, so this only upserts ' +
      'the Customer. The indexer links Subscription.customerId once the ' +
      'enrolment event confirms on-chain (by matching wallet address).',
  })
  @Public()
  @Post('/plans/:id/payer')
  async attachPlanPayer(
    @Param('id') planId: string,
    @Body() body: PayerIdentityDto,
  ): Promise<{ customerId: string }> {
    const plan = await this.plans.retrievePublic(planId)
    const customer = await this.customers.upsertFromCheckout({
      merchantId: plan.merchantId,
      walletAddress: body.walletAddress,
      email: body.email,
    })
    return { customerId: customer.id }
  }
}
