import {
  subscriptionSchema,
  cancelSubscriptionInputSchema,
  type Subscription,
  type CancelSubscriptionInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class SubscriptionsResource extends BaseResource {
  retrieve(id: string): Promise<Subscription> {
    return this.get(`/v1/subscriptions/${encodeURIComponent(id)}`, subscriptionSchema)
  }

  list(
    params?: PaginationParams & { status?: string; planId?: string },
  ): Promise<Page<Subscription>> {
    return this.listPage('/v1/subscriptions', subscriptionSchema, params)
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
