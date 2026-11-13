import {
  subscriptionSchema,
  subscriptionChargeSchema,
  cancelSubscriptionInputSchema,
  type Subscription,
  type SubscriptionCharge,
  type CancelSubscriptionInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class SubscriptionsResource extends BaseResource {
  retrieve(id: string): Promise<Subscription> {
    return this.get(`/v1/subscriptions/${encodeURIComponent(id)}`, subscriptionSchema)
  }

  list(
    params?: PaginationParams & { status?: string; planId?: string; customerId?: string },
  ): Promise<Page<Subscription>> {
    return this.listPage('/v1/subscriptions', subscriptionSchema, params)
  }

  /** Every charge attempt for a subscription, newest first, including failed and skipped ones. */
  charges(id: string, params?: PaginationParams): Promise<Page<SubscriptionCharge>> {
    return this.listPage(
      `/v1/subscriptions/${encodeURIComponent(id)}/charges`,
      subscriptionChargeSchema,
      params,
    )
  }

  cancel(input: CancelSubscriptionInput, options?: RequestOptions): Promise<Subscription> {
    cancelSubscriptionInputSchema.parse(input)
    return this.post(
      `/v1/subscriptions/${encodeURIComponent(input.id)}/cancel`,
      input,
      subscriptionSchema,
      options,
    )
  }
}
