import {
  paymentSessionSchema,
  createPaymentSessionInputSchema,
  type PaymentSession,
  type CreatePaymentSessionInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class PaymentSessionsResource extends BaseResource {
  create(input: CreatePaymentSessionInput, options?: RequestOptions): Promise<PaymentSession> {
    createPaymentSessionInputSchema.parse(input)
    return this.post('/v1/payment-sessions', input, paymentSessionSchema, options)
  }

  retrieve(id: string): Promise<PaymentSession> {
    return this.get(`/v1/payment-sessions/${encodeURIComponent(id)}`, paymentSessionSchema)
  }

  list(params?: PaginationParams & { status?: string }): Promise<Page<PaymentSession>> {
    return this.listPage('/v1/payment-sessions', paymentSessionSchema, params)
  }

  cancel(id: string, options?: RequestOptions): Promise<PaymentSession> {
    return this.post(
      `/v1/payment-sessions/${encodeURIComponent(id)}/cancel`,
      {},
      paymentSessionSchema,
      options,
    )
  }

  expire(id: string, options?: RequestOptions): Promise<PaymentSession> {
    return this.post(
      `/v1/payment-sessions/${encodeURIComponent(id)}/expire`,
      {},
      paymentSessionSchema,
      options,
    )
  }
}
