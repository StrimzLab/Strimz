/**
 * Transaction. The record of a confirmed on-chain payment.
 *
 * Every transaction corresponds to either a paid PaymentSession, a
 * SubscriptionCharge, or a Refund. Records are derived from the
 * `PaymentExecuted`, `SubscriptionCharged`, and `RefundRecorded` events.
 */

import { z } from 'zod'
import {
  chainIdSchema,
  idSchema,
  isoTimestampSchema,
  paymentCurrencySchema,
  tokenAmountSchema,
  walletAddressSchema,
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
  /**
   * Chain this transaction settled on. The indexer (Go for EVM,
   * TypeScript for Stellar) sets this when projecting the event.
   */
  chain: chainIdSchema,
  /** Widened from EVM-only to accept Stellar G-/C- addresses. */
  payerAddress: walletAddressSchema,
  /** Widened from EVM-only to accept Stellar G-/C- addresses. */
  merchantAddress: walletAddressSchema,
  /**
   * EVM tx hash is 0x + 64 hex (66 chars). Stellar tx hash is 64 hex
   * (no 0x prefix). Both fit; format is validated per-chain in the
   * adapter, not here.
   */
  onchainTxHash: z.string().min(1).max(80),
  blockNumber: z.number().int().nonnegative(),
  blockTimestamp: isoTimestampSchema,
  createdAt: isoTimestampSchema,
})
export type Transaction = z.infer<typeof transactionSchema>
