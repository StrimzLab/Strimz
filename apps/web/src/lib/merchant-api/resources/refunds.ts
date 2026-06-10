import type { CreateRefundInput, Refund, RefundStatus } from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListRefundsParams extends PaginationParams {
  status?: RefundStatus
  paymentSessionId?: string
}

export class RefundsResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(params: ListRefundsParams = {}, options?: CallOptions): Promise<Page<Refund>> {
    return this.client.get<Page<Refund>>('/v1/refunds', {
      ...options,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        status: params.status,
        paymentSessionId: params.paymentSessionId,
      },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<Refund> {
    return this.client.get<Refund>(`/v1/refunds/${encodeURIComponent(id)}`, options)
  }

  create(input: CreateRefundInput, options?: CallOptions): Promise<Refund> {
    return this.client.post<Refund>('/v1/refunds', input, options)
  }
}
