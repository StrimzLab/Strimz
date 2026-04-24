/**
 * Transaction — the record of a confirmed on-chain payment.
 *
 * Every transaction corresponds to either a paid PaymentSession, a
 * SubscriptionCharge, or a Refund. The indexer writes these from the
 * `PaymentExecuted`, `SubscriptionCharged`, and `RefundRecorded` events.
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

export const transactionKindSchema = z.enum([
  'one_shot',
  'subscription_charge',
  'refund',
  'invoice_payment',
  'storefront_purchase',
])
export type TransactionKind = z.infer<typeof transactionKindSchema>

export const transactionStatusSchema = z.enum(['pending', 'confirmed', 'failed'])
export type TransactionStatus = z.infer<typeof transactionStatusSchema>

export const transactionSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  kind: transactionKindSchema,
  status: transactionStatusSchema,
  sessionId: idSchema.nullable(),
  subscriptionId: idSchema.nullable(),
  subscriptionChargeId: idSchema.nullable(),
  refundId: idSchema.nullable(),
  customerId: idSchema.nullable(),
  amount: tokenAmountSchema,
  feeAmount: tokenAmountSchema,
  netAmount: tokenAmountSchema,
  currency: paymentCurrencySchema,
  payerAddress: evmAddressSchema,
  merchantAddress: evmAddressSchema,
  onchainTxHash: evmTxHashSchema,
  blockNumber: z.number().int().nonnegative(),
  blockTimestamp: isoTimestampSchema,
  createdAt: isoTimestampSchema,
})
export type Transaction = z.infer<typeof transactionSchema>
