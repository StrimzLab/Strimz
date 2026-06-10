import type { Transaction, TransactionKind, TransactionStatus } from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListTransactionsParams extends PaginationParams {
  status?: TransactionStatus
  kind?: TransactionKind
}

export class TransactionsResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(params: ListTransactionsParams = {}, options?: CallOptions): Promise<Page<Transaction>> {
    return this.client.get<Page<Transaction>>('/v1/transactions', {
      ...options,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        status: params.status,
        kind: params.kind,
      },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<Transaction> {
    return this.client.get<Transaction>(`/v1/transactions/${encodeURIComponent(id)}`, options)
  }
}
