import {
  subscriptionPlanSchema,
  createSubscriptionPlanInputSchema,
  type SubscriptionPlan,
  type CreateSubscriptionPlanInput,
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

  archive(id: string, options?: RequestOptions): Promise<SubscriptionPlan> {
    return this.post(
      `/v1/subscription-plans/${encodeURIComponent(id)}/archive`,
      {},
      subscriptionPlanSchema,
      options,
    )
  }
}
