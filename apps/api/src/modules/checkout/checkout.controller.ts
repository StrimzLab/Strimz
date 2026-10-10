import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type {
  MerchantPublicBrand,
  PaymentSession,
  SubscriptionEnrolmentTerms,
  SubscriptionPlan,
  SubscriptionStatusResult,
} from '@strimz/shared-types'

import { Public } from '../../common/decorators/public.decorator.js'
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js'
import { CustomersService } from '../customers/customers.service.js'
import { MerchantsService } from '../merchants/merchants.service.js'
import { PaymentSessionsService } from '../payment-sessions/payment-sessions.service.js'
import { CheckoutEnrolmentRelayDto, CheckoutPaymentRelayDto } from '../relay/relay.dto.js'
import { enrolmentRelayInput, paymentRelayInput } from '../relay/relay-inputs.js'
import { RelayService } from '../relay/relay.service.js'
import type { RelaySubmissionView } from '../relay/relay.types.js'
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service.js'
import { EnrolmentTermsService } from '../subscription-plans/enrolment-terms.service.js'
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
    private readonly terms: EnrolmentTermsService,
    private readonly relay: RelayService,
  ) {}

  @ApiOperation({
    summary: 'Load a merchant brand card by id (public)',
    description:
      'Returns businessName, logoUrl, and walletAddress so the hosted ' +
      'checkout can render the merchant identity. Public because the ' +
      'checkout URL already exposes the session/plan tied to this merchant.',
  })
  @Public()
  @RateLimit({ max: 120, windowMs: 60_000, keyBy: 'ip', label: 'checkout.merchant' })
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
  @RateLimit({ max: 120, windowMs: 60_000, keyBy: 'ip', label: 'checkout.session' })
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
  @RateLimit({ max: 120, windowMs: 60_000, keyBy: 'ip', label: 'checkout.plan' })
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
  @RateLimit({ max: 60, windowMs: 60_000, keyBy: 'ip', label: 'checkout.plan_subscription' })
  @Get('/plans/:id/subscription')
  async planSubscriptionStatus(
    @Param('id') planId: string,
    @Query('payer') payer: string,
  ): Promise<SubscriptionStatusResult> {
    await this.plans.retrievePublic(planId) // 404s on an unknown plan
    return this.subscriptions.activeForPayer(planId, payer ?? '')
  }

  @ApiOperation({
    summary: 'Enrolment terms a payer must sign for a plan (public)',
    description:
      'Returns the startAt to sign: the end of the trial for a payer who has ' +
      'never subscribed to this plan, otherwise 0. The relay rejects other values.',
  })
  @Public()
  @RateLimit({ max: 60, windowMs: 60_000, keyBy: 'ip', label: 'checkout.plan_terms' })
  @Get('/plans/:id/terms')
  planTerms(
    @Param('id') planId: string,
    @Query('payer') payer: string,
  ): Promise<SubscriptionEnrolmentTerms> {
    return this.terms.quote(planId, payer ?? '')
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
  @RateLimit({ max: 10, windowMs: 60_000, keyBy: 'ip', label: 'checkout.session_payer' })
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
  @RateLimit({ max: 10, windowMs: 60_000, keyBy: 'ip', label: 'checkout.plan_payer' })
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

  @ApiOperation({
    summary: 'Relay a payer-signed payment for a payment session (public)',
    description:
      'Submits the payer-signed EIP-3009 authorization for this session through the ' +
      'Strimz relayer. The session decides the merchant, the amount, the token and the ' +
      'authorization nonce; the submission is attributed to the session merchant. ' +
      'Idempotent on the signed payload.',
  })
  @Public()
  @RateLimit({ max: 20, windowMs: 60_000, keyBy: 'ip', label: 'checkout.session_relay' })
  @Post('/sessions/:id/relay')
  async relaySessionPayment(
    @Param('id') sessionId: string,
    @Body() body: CheckoutPaymentRelayDto,
  ): Promise<RelaySubmissionView> {
    const session = await this.sessions.retrievePublic(sessionId)
    return this.relay.submitPayWithAuthorization(
      paymentRelayInput(body, { merchantInternalId: session.merchantId, sessionId }),
    )
  }

  @ApiOperation({
    summary: 'Relay a payer-signed enrolment into a subscription plan (public)',
    description:
      'Submits the payer-signed EIP-2612 permit and enrolment for this plan through the ' +
      'Strimz relayer. The plan decides the merchant and the terms; the payer must hold ' +
      'at least the plan amount. Idempotent on the signed payload.',
  })
  @Public()
  @RateLimit({ max: 20, windowMs: 60_000, keyBy: 'ip', label: 'checkout.plan_relay' })
  @Post('/plans/:id/relay')
  async relayPlanEnrolment(
    @Param('id') planId: string,
    @Body() body: CheckoutEnrolmentRelayDto,
  ): Promise<RelaySubmissionView> {
    const plan = await this.plans.retrievePublic(planId)
    return this.relay.submitPermitAndCreateSubscription(
      enrolmentRelayInput(body, {
        merchantInternalId: plan.merchantId,
        subscriptionInternalId: planId,
      }),
    )
  }

  @ApiOperation({
    summary: 'Look up a relayed payment for a payment session (public)',
    description:
      'Returns the state of a relay submission made for this session. 404 when the key ' +
      'belongs to another session or merchant, or BullMQ aged it out.',
  })
  @Public()
  @RateLimit({ max: 120, windowMs: 60_000, keyBy: 'ip', label: 'checkout.session_submission' })
  @Get('/sessions/:id/submissions/:key')
  async sessionSubmission(
    @Param('id') sessionId: string,
    @Param('key') key: string,
  ): Promise<RelaySubmissionView> {
    const session = await this.sessions.retrievePublic(sessionId)
    return this.submission(key, session.merchantId, sessionId)
  }

  @ApiOperation({
    summary: 'Look up a relayed enrolment for a subscription plan (public)',
    description:
      'Returns the state of a relay submission made for this plan. 404 when the key ' +
      'belongs to another plan or merchant, or BullMQ aged it out.',
  })
  @Public()
  @RateLimit({ max: 120, windowMs: 60_000, keyBy: 'ip', label: 'checkout.plan_submission' })
  @Get('/plans/:id/submissions/:key')
  async planSubmission(
    @Param('id') planId: string,
    @Param('key') key: string,
  ): Promise<RelaySubmissionView> {
    const plan = await this.plans.retrievePublic(planId)
    return this.submission(key, plan.merchantId, planId)
  }

  private async submission(
    key: string,
    merchantInternalId: string,
    checkoutId: string,
  ): Promise<RelaySubmissionView> {
    const found = await this.relay.getByIdempotencyKey(key, {
      merchantInternalId,
      sessionId: checkoutId,
    })
    if (!found) {
      throw new NotFoundException({
        code: 'submission_not_found',
        message: `no relay submission for idempotency key ${key}`,
      })
    }
    return found
  }
}
