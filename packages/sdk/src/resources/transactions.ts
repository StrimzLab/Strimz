import { transactionSchema, type Transaction } from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource } from './base-resource.js'

export class TransactionsResource extends BaseResource {
  retrieve(id: string): Promise<Transaction> {
    return this.get(`/v1/transactions/${encodeURIComponent(id)}`, transactionSchema)
  }

  list(
    params?: PaginationParams & {
      kind?: string
      status?: string
      from?: string
      to?: string
    },
  ): Promise<Page<Transaction>> {
    return this.listPage('/v1/transactions', transactionSchema, params)
  }
}
