/**
 * Payment session — a one-shot checkout intent.
 *
 * State machine:
 *   created → awaiting_payment → submitted → confirmed
 *                                       \
 *                                        → failed
 *                               → expired
 *                               → cancelled
 */

import { z } from 'zod'
import {
  evmAddressSchema,
  evmTxHashSchema,
  idSchema,
  isoTimestampSchema,
  metadataSchema,
  paymentCurrencySchema,
  tokenAmountSchema,
} from './common.js'

export const paymentSessionStatusSchema = z.enum([
  'created',
  'awaiting_payment',
  'submitted',
  'confirmed',
  'failed',
  'expired',
  'cancelled',
])
export type PaymentSessionStatus = z.infer<typeof paymentSessionStatusSchema>

export const paymentSessionSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  customerId: idSchema.nullable(),
  status: paymentSessionStatusSchema,
  amount: tokenAmountSchema,
  currency: paymentCurrencySchema,
  feeAmount: tokenAmountSchema,
  netAmount: tokenAmountSchema,
  description: z.string().max(500).nullable(),
  payerWalletAddress: evmAddressSchema.nullable(),
  payerEmail: z.string().email().nullable(),
  successUrl: z.string().url().nullable(),
  cancelUrl: z.string().url().nullable(),
  sourceChain: z
    .enum(['arc', 'ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'solana'])
    .nullable(),
  bridgeTxHash: evmTxHashSchema.nullable(),
  onchainTxHash: evmTxHashSchema.nullable(),
  checkoutUrl: z.string().url(),
  metadata: metadataSchema,
  expiresAt: isoTimestampSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type PaymentSession = z.infer<typeof paymentSessionSchema>

// ---------- DTOs ----------

export const createPaymentSessionInputSchema = z.object({
  amount: tokenAmountSchema,
  currency: paymentCurrencySchema,
  description: z.string().max(500).optional(),
  customer: z
    .object({
      walletAddress: evmAddressSchema.optional(),
      email: z.string().email().optional(),
      externalRef: z.string().max(120).optional(),
    })
    .optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  /** Minutes until the session expires. Default 30, max 60*24 (one day). */
  expiresInMinutes: z
    .number()
    .int()
    .min(1)
    .max(60 * 24)
    .default(30),
  /**
   * Allowed source chains a payer can bridge USDC from via CCTP. Omit to
   * accept every CCTP-supported chain.
   */
  supportedSourceChains: z
    .array(
      z.enum(['arc', 'ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'solana']),
    )
    .optional(),
  metadata: metadataSchema.optional(),
})
export type CreatePaymentSessionInput = z.infer<typeof createPaymentSessionInputSchema>

export const submitPaymentSessionInputSchema = z.object({
  sourceChain: z.enum([
    'arc',
    'ethereum',
    'base',
    'polygon',
    'arbitrum',
    'optimism',
    'avalanche',
    'solana',
  ]),
  onchainTxHash: evmTxHashSchema,
  bridgeTxHash: evmTxHashSchema.optional(),
  payerWalletAddress: evmAddressSchema,
})
export type SubmitPaymentSessionInput = z.infer<typeof submitPaymentSessionInputSchema>
