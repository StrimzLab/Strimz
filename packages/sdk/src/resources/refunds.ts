import {
  refundSchema,
  createRefundInputSchema,
  submitRefundSignatureInputSchema,
  type Refund,
  type CreateRefundInput,
  type SubmitRefundSignatureInput,
} from '@strimz/shared-types'
import type { PaginationParams, Page } from '../pagination.js'
import { BaseResource, type RequestOptions } from './base-resource.js'

export class RefundsResource extends BaseResource {
  create(input: CreateRefundInput, options?: RequestOptions): Promise<Refund> {
    createRefundInputSchema.parse(input)
    return this.post('/v1/refunds', input, refundSchema, options)
  }

  retrieve(id: string): Promise<Refund> {
    return this.get(`/v1/refunds/${encodeURIComponent(id)}`, refundSchema)
  }

  list(params?: PaginationParams & { status?: string }): Promise<Page<Refund>> {
    return this.listPage('/v1/refunds', refundSchema, params)
  }

  /** Record the on-chain refund tx after the merchant signs from their wallet. */
  submitSignature(input: SubmitRefundSignatureInput, options?: RequestOptions): Promise<Refund> {
    submitRefundSignatureInputSchema.parse(input)
    return this.post(
      `/v1/refunds/${encodeURIComponent(input.id)}/signature`,
      input,
      refundSchema,
      options,
    )
  }
}
