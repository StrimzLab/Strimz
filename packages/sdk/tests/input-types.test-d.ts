import { describe, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import type * as T from '@strimz/shared-types'
import type { StrimzClient } from '../src/index.js'

type FirstArg<F> = F extends (input: infer I, ...rest: never[]) => unknown ? I : never

declare const client: StrimzClient

describe('SDK request methods take the caller-facing input type', () => {
  it('paymentSessions.create accepts a body without expiresInMinutes', () => {
    expectTypeOf(client.paymentSessions.create).toBeCallableWith({
      amount: '1000000',
      currency: 'USDC',
    })
  })

  it('subscriptionPlans.create accepts a body without intervalCount', () => {
    expectTypeOf(client.subscriptionPlans.create).toBeCallableWith({
      name: 'Pro',
      amount: '1000000',
      currency: 'USDC',
      interval: 'monthly',
    })
  })

  it('subscriptions.create accepts a body without gracePeriodHours', () => {
    expectTypeOf(client.subscriptions.create).toBeCallableWith({
      planId: 'plan_1',
      customer: { walletAddress: '0x0000000000000000000000000000000000000001' },
    })
  })

  it('invoices.create accepts a body without dueInDays', () => {
    expectTypeOf(client.invoices.create).toBeCallableWith({
      lineItems: [{ description: 'Seat', quantity: 1, unitAmount: '1000000' }],
      currency: 'USDC',
    })
  })

  it('storefronts.upsert accepts a body without socialLinks', () => {
    expectTypeOf(client.storefronts.upsert).toBeCallableWith({
      slug: 'acme',
      name: 'Acme',
      description: null,
      logoUrl: null,
      coverImageUrl: null,
      accentColor: null,
    })
  })

  it('storefronts.createProduct accepts a body without sortOrder', () => {
    expectTypeOf(client.storefronts.createProduct).toBeCallableWith({
      name: 'Seat',
      description: null,
      price: '1000000',
      currency: 'USDC',
      type: 'one_time',
      interval: null,
      intervalCount: null,
      stock: null,
      isActive: true,
    })
  })

  it('agents.updateConfig accepts a partial nested section', () => {
    expectTypeOf(client.agents.updateConfig).toBeCallableWith({
      cashflow: { digestEnabled: true },
    })
  })

  it('every input-taking method is typed with z.input of its schema', () => {
    expectTypeOf<FirstArg<StrimzClient['merchants']['update']>>().toEqualTypeOf<
      z.input<typeof T.updateMerchantInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['merchants']['changeTier']>>().toEqualTypeOf<
      z.input<typeof T.changeTierInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['apiKeys']['create']>>().toEqualTypeOf<
      z.input<typeof T.createApiKeyInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['customers']['upsert']>>().toEqualTypeOf<
      z.input<typeof T.upsertCustomerInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['paymentSessions']['create']>>().toEqualTypeOf<
      z.input<typeof T.createPaymentSessionInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['subscriptionPlans']['create']>>().toEqualTypeOf<
      z.input<typeof T.createSubscriptionPlanInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['subscriptions']['create']>>().toEqualTypeOf<
      z.input<typeof T.createSubscriptionInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['subscriptions']['cancel']>>().toEqualTypeOf<
      z.input<typeof T.cancelSubscriptionInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['refunds']['create']>>().toEqualTypeOf<
      z.input<typeof T.createRefundInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['refunds']['submitSignature']>>().toEqualTypeOf<
      z.input<typeof T.submitRefundSignatureInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['webhookEndpoints']['create']>>().toEqualTypeOf<
      z.input<typeof T.createWebhookEndpointInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['invoices']['create']>>().toEqualTypeOf<
      z.input<typeof T.createInvoiceInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['storefronts']['upsert']>>().toEqualTypeOf<
      z.input<typeof T.createStorefrontInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['storefronts']['createProduct']>>().toEqualTypeOf<
      z.input<typeof T.createStorefrontProductInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['agents']['updateConfig']>>().toEqualTypeOf<
      z.input<typeof T.updateAgentConfigInputSchema>
    >()
    expectTypeOf<FirstArg<StrimzClient['agents']['createJob']>>().toEqualTypeOf<
      z.input<typeof T.createAgentJobInputSchema>
    >()
  })
})

describe('shared-types Input aliases are z.input of their schema', () => {
  it('matches for every exported InputSchema', () => {
    expectTypeOf<T.PaginationInput>().toEqualTypeOf<z.input<typeof T.paginationInputSchema>>()
    expectTypeOf<T.CreateMerchantInput>().toEqualTypeOf<
      z.input<typeof T.createMerchantInputSchema>
    >()
    expectTypeOf<T.UpdateMerchantInput>().toEqualTypeOf<
      z.input<typeof T.updateMerchantInputSchema>
    >()
    expectTypeOf<T.ChangeTierInput>().toEqualTypeOf<z.input<typeof T.changeTierInputSchema>>()
    expectTypeOf<T.OnboardMerchantInput>().toEqualTypeOf<
      z.input<typeof T.onboardMerchantInputSchema>
    >()
    expectTypeOf<T.InviteMemberInput>().toEqualTypeOf<z.input<typeof T.inviteMemberInputSchema>>()
    expectTypeOf<T.LoginInput>().toEqualTypeOf<z.input<typeof T.loginInputSchema>>()
    expectTypeOf<T.CreateApiKeyInput>().toEqualTypeOf<z.input<typeof T.createApiKeyInputSchema>>()
    expectTypeOf<T.RotateApiKeyInput>().toEqualTypeOf<z.input<typeof T.rotateApiKeyInputSchema>>()
    expectTypeOf<T.UpsertCustomerInput>().toEqualTypeOf<
      z.input<typeof T.upsertCustomerInputSchema>
    >()
    expectTypeOf<T.CreatePaymentSessionInput>().toEqualTypeOf<
      z.input<typeof T.createPaymentSessionInputSchema>
    >()
    expectTypeOf<T.SubmitPaymentSessionInput>().toEqualTypeOf<
      z.input<typeof T.submitPaymentSessionInputSchema>
    >()
    expectTypeOf<T.CreateSubscriptionPlanInput>().toEqualTypeOf<
      z.input<typeof T.createSubscriptionPlanInputSchema>
    >()
    expectTypeOf<T.CreateSubscriptionInput>().toEqualTypeOf<
      z.input<typeof T.createSubscriptionInputSchema>
    >()
    expectTypeOf<T.CancelSubscriptionInput>().toEqualTypeOf<
      z.input<typeof T.cancelSubscriptionInputSchema>
    >()
    expectTypeOf<T.CreateRefundInput>().toEqualTypeOf<z.input<typeof T.createRefundInputSchema>>()
    expectTypeOf<T.SubmitRefundSignatureInput>().toEqualTypeOf<
      z.input<typeof T.submitRefundSignatureInputSchema>
    >()
    expectTypeOf<T.CreateWebhookEndpointInput>().toEqualTypeOf<
      z.input<typeof T.createWebhookEndpointInputSchema>
    >()
    expectTypeOf<T.ReplayDeliveryInput>().toEqualTypeOf<
      z.input<typeof T.replayDeliveryInputSchema>
    >()
    expectTypeOf<T.UpdateAgentConfigInput>().toEqualTypeOf<
      z.input<typeof T.updateAgentConfigInputSchema>
    >()
    expectTypeOf<T.CreateAgentJobInput>().toEqualTypeOf<
      z.input<typeof T.createAgentJobInputSchema>
    >()
    expectTypeOf<T.CreateStorefrontInput>().toEqualTypeOf<
      z.input<typeof T.createStorefrontInputSchema>
    >()
    expectTypeOf<T.CreateStorefrontProductInput>().toEqualTypeOf<
      z.input<typeof T.createStorefrontProductInputSchema>
    >()
    expectTypeOf<T.StorefrontCheckoutInput>().toEqualTypeOf<
      z.input<typeof T.storefrontCheckoutInputSchema>
    >()
    expectTypeOf<T.CreateInvoiceInput>().toEqualTypeOf<z.input<typeof T.createInvoiceInputSchema>>()
    expectTypeOf<T.ContactRequestInput>().toEqualTypeOf<
      z.input<typeof T.contactRequestInputSchema>
    >()
    expectTypeOf<T.CreateBroadcastInput>().toEqualTypeOf<
      z.input<typeof T.createBroadcastInputSchema>
    >()
  })
})

describe('shared-types Parsed aliases are z.output of their schema', () => {
  it('matches for every exported InputSchema', () => {
    expectTypeOf<T.PaginationParsed>().toEqualTypeOf<z.output<typeof T.paginationInputSchema>>()
    expectTypeOf<T.CreateMerchantParsed>().toEqualTypeOf<
      z.output<typeof T.createMerchantInputSchema>
    >()
    expectTypeOf<T.UpdateMerchantParsed>().toEqualTypeOf<
      z.output<typeof T.updateMerchantInputSchema>
    >()
    expectTypeOf<T.ChangeTierParsed>().toEqualTypeOf<z.output<typeof T.changeTierInputSchema>>()
    expectTypeOf<T.OnboardMerchantParsed>().toEqualTypeOf<
      z.output<typeof T.onboardMerchantInputSchema>
    >()
    expectTypeOf<T.InviteMemberParsed>().toEqualTypeOf<z.output<typeof T.inviteMemberInputSchema>>()
    expectTypeOf<T.LoginParsed>().toEqualTypeOf<z.output<typeof T.loginInputSchema>>()
    expectTypeOf<T.CreateApiKeyParsed>().toEqualTypeOf<z.output<typeof T.createApiKeyInputSchema>>()
    expectTypeOf<T.RotateApiKeyParsed>().toEqualTypeOf<z.output<typeof T.rotateApiKeyInputSchema>>()
    expectTypeOf<T.UpsertCustomerParsed>().toEqualTypeOf<
      z.output<typeof T.upsertCustomerInputSchema>
    >()
    expectTypeOf<T.CreatePaymentSessionParsed>().toEqualTypeOf<
      z.output<typeof T.createPaymentSessionInputSchema>
    >()
    expectTypeOf<T.SubmitPaymentSessionParsed>().toEqualTypeOf<
      z.output<typeof T.submitPaymentSessionInputSchema>
    >()
    expectTypeOf<T.CreateSubscriptionPlanParsed>().toEqualTypeOf<
      z.output<typeof T.createSubscriptionPlanInputSchema>
    >()
    expectTypeOf<T.CreateSubscriptionParsed>().toEqualTypeOf<
      z.output<typeof T.createSubscriptionInputSchema>
    >()
    expectTypeOf<T.CancelSubscriptionParsed>().toEqualTypeOf<
      z.output<typeof T.cancelSubscriptionInputSchema>
    >()
    expectTypeOf<T.CreateRefundParsed>().toEqualTypeOf<z.output<typeof T.createRefundInputSchema>>()
    expectTypeOf<T.SubmitRefundSignatureParsed>().toEqualTypeOf<
      z.output<typeof T.submitRefundSignatureInputSchema>
    >()
    expectTypeOf<T.CreateWebhookEndpointParsed>().toEqualTypeOf<
      z.output<typeof T.createWebhookEndpointInputSchema>
    >()
    expectTypeOf<T.ReplayDeliveryParsed>().toEqualTypeOf<
      z.output<typeof T.replayDeliveryInputSchema>
    >()
    expectTypeOf<T.UpdateAgentConfigParsed>().toEqualTypeOf<
      z.output<typeof T.updateAgentConfigInputSchema>
    >()
    expectTypeOf<T.CreateAgentJobParsed>().toEqualTypeOf<
      z.output<typeof T.createAgentJobInputSchema>
    >()
    expectTypeOf<T.CreateStorefrontParsed>().toEqualTypeOf<
      z.output<typeof T.createStorefrontInputSchema>
    >()
    expectTypeOf<T.CreateStorefrontProductParsed>().toEqualTypeOf<
      z.output<typeof T.createStorefrontProductInputSchema>
    >()
    expectTypeOf<T.StorefrontCheckoutParsed>().toEqualTypeOf<
      z.output<typeof T.storefrontCheckoutInputSchema>
    >()
    expectTypeOf<T.CreateInvoiceParsed>().toEqualTypeOf<
      z.output<typeof T.createInvoiceInputSchema>
    >()
    expectTypeOf<T.ContactRequestParsed>().toEqualTypeOf<
      z.output<typeof T.contactRequestInputSchema>
    >()
    expectTypeOf<T.CreateBroadcastParsed>().toEqualTypeOf<
      z.output<typeof T.createBroadcastInputSchema>
    >()
  })
})
