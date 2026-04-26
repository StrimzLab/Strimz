import {
  invoiceSchema,
  createInvoiceInputSchema,
  type Invoice,
  type CreateInvoiceInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class InvoicesResource extends BaseResource {
  create(input: CreateInvoiceInput, options?: RequestOptions): Promise<Invoice> {
    createInvoiceInputSchema.parse(input)
    return this.post('/v1/invoices', input, invoiceSchema, options)
  }

  retrieve(id: string): Promise<Invoice> {
    return this.get(`/v1/invoices/${encodeURIComponent(id)}`, invoiceSchema)
  }

  list(params?: PaginationParams & { status?: string }): Promise<Page<Invoice>> {
    return this.listPage('/v1/invoices', invoiceSchema, params)
  }

  send(id: string, options?: RequestOptions): Promise<Invoice> {
    return this.post(`/v1/invoices/${encodeURIComponent(id)}/send`, {}, invoiceSchema, options)
  }

  void(id: string, options?: RequestOptions): Promise<Invoice> {
    return this.post(`/v1/invoices/${encodeURIComponent(id)}/void`, {}, invoiceSchema, options)
  }
}
