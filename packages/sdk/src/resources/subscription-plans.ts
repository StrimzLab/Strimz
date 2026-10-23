import {
  subscriptionPlanSchema,
  createSubscriptionPlanInputSchema,
  updateSubscriptionPlanInputSchema,
  type SubscriptionPlan,
  type CreateSubscriptionPlanInput,
  type UpdateSubscriptionPlanInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class SubscriptionPlansResource extends BaseResource {
  create(input: CreateSubscriptionPlanInput, options?: RequestOptions): Promise<SubscriptionPlan> {
    createSubscriptionPlanInputSchema.parse(input)
    return this.post('/v1/subscription-plans', input, subscriptionPlanSchema, options)
  }

  retrieve(id: string): Promise<SubscriptionPlan> {
    return this.get(`/v1/subscription-plans/${encodeURIComponent(id)}`, subscriptionPlanSchema)
  }

  list(params?: PaginationParams & { status?: string }): Promise<Page<SubscriptionPlan>> {
    return this.listPage('/v1/subscription-plans', subscriptionPlanSchema, params)
  }

  /** Only the return URLs can change. `null` clears one. */
  update(id: string, input: UpdateSubscriptionPlanInput): Promise<SubscriptionPlan> {
    updateSubscriptionPlanInputSchema.parse(input)
    return this.patch(
      `/v1/subscription-plans/${encodeURIComponent(id)}`,
      input,
      subscriptionPlanSchema,
    )
  }

  archive(id: string, options?: RequestOptions): Promise<SubscriptionPlan> {
    return this.post(
      `/v1/subscription-plans/${encodeURIComponent(id)}/archive`,
      {},
      subscriptionPlanSchema,
      options,
    )
  }
}
