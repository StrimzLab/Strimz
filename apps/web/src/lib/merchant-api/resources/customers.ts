import type { Customer, UpsertCustomerInput } from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListCustomersParams extends PaginationParams {
  query?: string
}

export class CustomersResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(params: ListCustomersParams = {}, options?: CallOptions): Promise<Page<Customer>> {
    return this.client.get<Page<Customer>>('/v1/customers', {
      ...options,
      query: { cursor: params.cursor, limit: params.limit, query: params.query },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<Customer> {
    return this.client.get<Customer>(`/v1/customers/${encodeURIComponent(id)}`, options)
  }

  upsert(input: UpsertCustomerInput, options?: CallOptions): Promise<Customer> {
    return this.client.post<Customer>('/v1/customers', input, options)
  }
}
