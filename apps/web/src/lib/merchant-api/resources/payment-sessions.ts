import type {
  CreatePaymentSessionInput,
  PaymentSession,
  PaymentSessionStatus,
} from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListPaymentSessionsParams extends PaginationParams {
  status?: PaymentSessionStatus
}

/**
 * Resource binding for `/v1/payment-sessions`. Returns the entity types
 * straight from `@strimz/shared-types` — same source of truth as the API
 * + the SDK, so the dashboard, the SDK consumers, and apps/api never
 * drift on field names.
 */
export class PaymentSessionsResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(
    params: ListPaymentSessionsParams = {},
    options?: CallOptions,
  ): Promise<Page<PaymentSession>> {
    return this.client.get<Page<PaymentSession>>('/v1/payment-sessions', {
      ...options,
      query: { cursor: params.cursor, limit: params.limit, status: params.status },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<PaymentSession> {
    return this.client.get<PaymentSession>(
      `/v1/payment-sessions/${encodeURIComponent(id)}`,
      options,
    )
  }

  create(input: CreatePaymentSessionInput, options?: CallOptions): Promise<PaymentSession> {
    return this.client.post<PaymentSession>('/v1/payment-sessions', input, options)
  }

  cancel(id: string, options?: CallOptions): Promise<PaymentSession> {
    return this.client.post<PaymentSession>(
      `/v1/payment-sessions/${encodeURIComponent(id)}/cancel`,
      {},
      options,
    )
  }

  expire(id: string, options?: CallOptions): Promise<PaymentSession> {
    return this.client.post<PaymentSession>(
      `/v1/payment-sessions/${encodeURIComponent(id)}/expire`,
      {},
      options,
    )
  }
}
