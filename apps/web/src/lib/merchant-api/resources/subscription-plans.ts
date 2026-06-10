import type {
  CreateSubscriptionPlanInput,
  SubscriptionPlan,
  SubscriptionPlanStatus,
} from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListSubscriptionPlansParams extends PaginationParams {
  status?: SubscriptionPlanStatus
}

export class SubscriptionPlansResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(
    params: ListSubscriptionPlansParams = {},
    options?: CallOptions,
  ): Promise<Page<SubscriptionPlan>> {
    return this.client.get<Page<SubscriptionPlan>>('/v1/subscription-plans', {
      ...options,
      query: { cursor: params.cursor, limit: params.limit, status: params.status },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<SubscriptionPlan> {
    return this.client.get<SubscriptionPlan>(
      `/v1/subscription-plans/${encodeURIComponent(id)}`,
      options,
    )
  }

  create(input: CreateSubscriptionPlanInput, options?: CallOptions): Promise<SubscriptionPlan> {
    return this.client.post<SubscriptionPlan>('/v1/subscription-plans', input, options)
  }

  archive(id: string, options?: CallOptions): Promise<SubscriptionPlan> {
    return this.client.post<SubscriptionPlan>(
      `/v1/subscription-plans/${encodeURIComponent(id)}/archive`,
      {},
      options,
    )
  }
}
