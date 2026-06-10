import type {
  CancelSubscriptionInput,
  Subscription,
  SubscriptionCharge,
  SubscriptionStatus,
} from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListSubscriptionsParams extends PaginationParams {
  status?: SubscriptionStatus
  planId?: string
  customerId?: string
}

export interface ListSubscriptionChargesParams extends PaginationParams {
  subscriptionId: string
}

export class SubscriptionsResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(params: ListSubscriptionsParams = {}, options?: CallOptions): Promise<Page<Subscription>> {
    return this.client.get<Page<Subscription>>('/v1/subscriptions', {
      ...options,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        status: params.status,
        planId: params.planId,
        customerId: params.customerId,
      },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<Subscription> {
    return this.client.get<Subscription>(`/v1/subscriptions/${encodeURIComponent(id)}`, options)
  }

  cancel(input: CancelSubscriptionInput, options?: CallOptions): Promise<Subscription> {
    const { id, ...body } = input
    return this.client.post<Subscription>(
      `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
      body,
      options,
    )
  }

  listCharges(
    params: ListSubscriptionChargesParams,
    options?: CallOptions,
  ): Promise<Page<SubscriptionCharge>> {
    return this.client.get<Page<SubscriptionCharge>>(
      `/v1/subscriptions/${encodeURIComponent(params.subscriptionId)}/charges`,
      {
        ...options,
        query: { cursor: params.cursor, limit: params.limit },
      },
    )
  }
}
