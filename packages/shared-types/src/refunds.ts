/**
 * Refund — a merchant-initiated return of funds to a payer.
 *
 * Refunds are executed off-chain (from the merchant's wallet to the payer's
 * wallet). Strimz records the intent, validates constraints, and reconciles
 * via the merchant-signed on-chain transfer.
 */

import { z } from 'zod'
import {
  evmAddressSchema,
  evmTxHashSchema,
  idSchema,
  isoTimestampSchema,
  paymentCurrencySchema,
  tokenAmountSchema,
} from './common.js'

export const refundReasonSchema = z.enum([
  'customer_request',
  'product_issue',
  'duplicate_charge',
  'fraudulent',
  'other',
])
export type RefundReason = z.infer<typeof refundReasonSchema>

export const refundStatusSchema = z.enum([
  'pending',
  'awaiting_signature',
  'submitted',
  'completed',
  'failed',
  'cancelled',
])
export type RefundStatus = z.infer<typeof refundStatusSchema>

export const refundSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  transactionId: idSchema,
  amount: tokenAmountSchema,
  currency: paymentCurrencySchema,
  reason: refundReasonSchema,
  note: z.string().max(500).nullable(),
  status: refundStatusSchema,
  payerAddress: evmAddressSchema,
  refundTxHash: evmTxHashSchema.nullable(),
  failureReason: z.string().max(500).nullable(),
  initiatedBy: idSchema,
  createdAt: isoTimestampSchema,
  completedAt: isoTimestampSchema.nullable(),
})
export type Refund = z.infer<typeof refundSchema>

export const createRefundInputSchema = z.object({
  transactionId: idSchema,
  amount: tokenAmountSchema,
  reason: refundReasonSchema,
  note: z.string().max(500).optional(),
})
export type CreateRefundInput = z.infer<typeof createRefundInputSchema>

export const submitRefundSignatureInputSchema = z.object({
  id: idSchema,
  refundTxHash: evmTxHashSchema,
})
export type SubmitRefundSignatureInput = z.infer<typeof submitRefundSignatureInputSchema>
