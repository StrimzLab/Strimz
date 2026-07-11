import type { CreateInvoiceInput, Invoice, InvoiceStatus } from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions, Page, PaginationParams } from '../types'

export interface ListInvoicesParams extends PaginationParams {
  status?: InvoiceStatus
}

export class InvoicesResource {
  constructor(private readonly client: MerchantApiClient) {}

  list(params: ListInvoicesParams = {}, options?: CallOptions): Promise<Page<Invoice>> {
    return this.client.get<Page<Invoice>>('/v1/invoices', {
      ...options,
      query: {
        cursor: params.cursor,
        limit: params.limit,
        status: params.status,
      },
    })
  }

  retrieve(id: string, options?: CallOptions): Promise<Invoice> {
    return this.client.get<Invoice>(`/v1/invoices/${encodeURIComponent(id)}`, options)
  }

  create(input: CreateInvoiceInput, options?: CallOptions): Promise<Invoice> {
    return this.client.post<Invoice>('/v1/invoices', input, options)
  }

  send(id: string, options?: CallOptions): Promise<Invoice> {
    return this.client.post<Invoice>(`/v1/invoices/${encodeURIComponent(id)}/send`, {}, options)
  }

  void(id: string, options?: CallOptions): Promise<Invoice> {
    return this.client.post<Invoice>(`/v1/invoices/${encodeURIComponent(id)}/void`, {}, options)
  }
}
