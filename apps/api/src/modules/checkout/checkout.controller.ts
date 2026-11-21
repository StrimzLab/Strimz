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
import { MerchantsService } from '../merchants/merchants.service.js'
import { PaymentSessionsService } from '../payment-sessions/payment-sessions.service.js'
import {
  CheckoutAllowanceRelayDto,
  CheckoutEnrolmentRelayDto,
  CheckoutPaymentRelayDto,
  ManageSubscriptionCancelDto,
  ManageSubscriptionsListDto,
} from '../relay/relay.dto.js'
import { enrolmentRelayInput, paymentRelayInput } from '../relay/relay-inputs.js'
import { RelayService } from '../relay/relay.service.js'
import type { RelaySubmissionView } from '../relay/relay.types.js'
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service.js'
import { EnrolmentTermsService } from '../subscription-plans/enrolment-terms.service.js'
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js'
import { CheckoutPayerService } from './checkout-payer.service.js'
import { CheckoutRenewalService, type SubscriptionRenewalView } from './checkout-renewal.service.js'
import { CheckoutManageService, type ManagedSubscriptionsView } from './checkout-manage.service.js'
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
    private readonly merchants: MerchantsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly terms: EnrolmentTermsService,
    private readonly relay: RelayService,
    private readonly payers: CheckoutPayerService,
    private readonly renewals: CheckoutRenewalService,
    private readonly manage: CheckoutManageService,
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
      'and enters an email but before they sign the meta-tx. Creates a ' +
      'Customer on the merchant keyed by (merchantId, walletAddress), or sets ' +
      'the email of an existing one that has none (a known email is never ' +
      'replaced), and links the session to the customer so the receipt can ' +
      'find the payer once the on-chain confirmation lands. Answers 409 ' +
      'session_not_open unless the session is open and unexpired, and 409 ' +
      'payer_already_bound when it is linked to another wallet.',
  })
  @Public()
  @RateLimit({ max: 10, windowMs: 60_000, keyBy: 'ip', label: 'checkout.session_payer' })
  @Post('/sessions/:id/payer')
  attachSessionPayer(
    @Param('id') sessionId: string,
    @Body() body: PayerIdentityDto,
  ): Promise<{ customerId: string }> {
    return this.payers.attachToSession(sessionId, {
      walletAddress: body.walletAddress,
      email: body.email,
    })
  }

  @ApiOperation({
    summary: 'Attach a payer identity to a subscription plan (public)',
    description:
      'Same shape as the session variant, but scoped to a plan. Used by ' +
      'the /sub/:planId page before the payer signs the permit. No ' +
      'subscription row exists yet at this point, so this only creates ' +
      'the Customer or fills a missing email. The indexer links ' +
      'Subscription.customerId once the enrolment event confirms on-chain ' +
      '(by matching wallet address). Answers 409 plan_not_active for an ' +
      'archived plan.',
  })
  @Public()
  @RateLimit({ max: 10, windowMs: 60_000, keyBy: 'ip', label: 'checkout.plan_payer' })
  @Post('/plans/:id/payer')
  attachPlanPayer(
    @Param('id') planId: string,
    @Body() body: PayerIdentityDto,
  ): Promise<{ customerId: string }> {
    return this.payers.attachToPlan(planId, {
      walletAddress: body.walletAddress,
      email: body.email,
    })
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

  @ApiOperation({
    summary: 'A subscription as its payer sees it on the renewal page (public)',
    description:
      'Plan, amount, token, the payer wallet and the spender, so the payer can sign a new ' +
      'allowance. The suggested allowance is added to what the wallet has already approved.',
  })
  @Public()
  @RateLimit({ max: 60, windowMs: 60_000, keyBy: 'ip', label: 'checkout.subscription_renewal' })
  @Get('/subscriptions/:id/renewal')
  subscriptionRenewal(@Param('id') id: string): Promise<SubscriptionRenewalView> {
    return this.renewals.details(id)
  }

  @ApiOperation({
    summary: 'Relay a payer-signed allowance renewal for a subscription (public)',
    description:
      'Submits the payer-signed EIP-2612 permit to the Subscriptions contract through the ' +
      'Strimz relayer. Only the subscription payer, for its token, at least one charge, while ' +
      'the subscription is trialing, active or at risk. Idempotent on the signed payload.',
  })
  @Public()
  @RateLimit({ max: 20, windowMs: 60_000, keyBy: 'ip', label: 'checkout.subscription_allowance' })
  @Post('/subscriptions/:id/allowance')
  renewAllowance(
    @Param('id') id: string,
    @Body() body: CheckoutAllowanceRelayDto,
  ): Promise<RelaySubmissionView> {
    return this.renewals.renew(id, body)
  }

  @ApiOperation({
    summary: 'Look up a relayed allowance renewal for a subscription (public)',
    description: 'Returns the state of a renewal relayed for this subscription. 404 otherwise.',
  })
  @Public()
  @RateLimit({ max: 120, windowMs: 60_000, keyBy: 'ip', label: 'checkout.subscription_submission' })
  @Get('/subscriptions/:id/submissions/:key')
  async subscriptionSubmission(
    @Param('id') id: string,
    @Param('key') key: string,
  ): Promise<RelaySubmissionView> {
    return this.submission(key, await this.renewals.merchantOf(id), id)
  }

  @ApiOperation({
    summary: "List a wallet's open subscriptions (public, signed)",
    description:
      'The wallet signs an EIP-712 ViewSubscriptions(payer, issuedAt), valid for ten minutes. ' +
      "Returns that wallet's trialing, active and at-risk subscriptions, and nothing for any " +
      'other wallet.',
  })
  @Public()
  @RateLimit({ max: 30, windowMs: 60_000, keyBy: 'ip', label: 'checkout.manage_list' })
  @Post('/manage/subscriptions')
  manageSubscriptions(@Body() body: ManageSubscriptionsListDto): Promise<ManagedSubscriptionsView> {
    return this.manage.list(body)
  }

  @ApiOperation({
    summary: 'Cancel a subscription with the payer signature (public)',
    description:
      'The payer signs an EIP-712 CancelSubscription(subscriptionId, deadline) on the ' +
      'Subscriptions contract. Strimz checks it, then relays cancelWithSig and pays the gas. ' +
      'Poll /subscriptions/:id/submissions/:key for the result.',
  })
  @Public()
  @RateLimit({ max: 10, windowMs: 60_000, keyBy: 'ip', label: 'checkout.manage_cancel' })
  @Post('/manage/subscriptions/:id/cancel')
  cancelManagedSubscription(
    @Param('id') id: string,
    @Body() body: ManageSubscriptionCancelDto,
  ): Promise<RelaySubmissionView> {
    return this.manage.cancel(id, body)
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
