import {
  paymentSessionSchema,
  subscriptionPlanSchema,
  type PaymentSession,
  type SubscriptionPlan,
} from '@strimz/shared-types'
import { BaseResource } from './base-resource.js'

/**
 * Public hosted-checkout reads.
 *
 * Backed by the `/v1/checkout/*` namespace on the Strimz API, which
 * is intentionally unauthenticated — session and plan records are
 * what a merchant offers to payers, so a payer landing on a checkout
 * URL must be able to load the terms without holding any API key.
 *
 * Use this resource (via `StrimzBrowserClient.checkout`) from the
 * browser. The merchant-scoped `paymentSessions` / `subscriptionPlans`
 * resources on `StrimzClient` remain the right call from server-side
 * code with a secret key.
 */
export class CheckoutResource extends BaseResource {
  /** Load a payment session by id (public — no merchant scoping). */
  session(id: string): Promise<PaymentSession> {
    return this.get(`/v1/checkout/sessions/${encodeURIComponent(id)}`, paymentSessionSchema)
  }

  /** Load a subscription plan by id (public — no merchant scoping). */
  plan(id: string): Promise<SubscriptionPlan> {
    return this.get(`/v1/checkout/plans/${encodeURIComponent(id)}`, subscriptionPlanSchema)
  }
}
