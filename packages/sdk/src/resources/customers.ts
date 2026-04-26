import {
  customerSchema,
  upsertCustomerInputSchema,
  type Customer,
  type UpsertCustomerInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class CustomersResource extends BaseResource {
  retrieve(id: string): Promise<Customer> {
    return this.get(`/v1/customers/${encodeURIComponent(id)}`, customerSchema)
  }

  list(params?: PaginationParams & { externalRef?: string; walletAddress?: string }): Promise<Page<Customer>> {
    return this.listPage('/v1/customers', customerSchema, params)
  }

  upsert(input: UpsertCustomerInput, options?: RequestOptions): Promise<Customer> {
    upsertCustomerInputSchema.parse(input)
    return this.post('/v1/customers', input, customerSchema, options)
  }
}
