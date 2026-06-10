/**
 * Payment session. A one-shot checkout intent.
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

/**
 * Merchant-supplied callback URL. The hosted checkout dispatches with
 * `window.location.href = redirectUrl` on completion / cancellation,
 * so we MUST reject anything other than `http://` and `https://`.
 *
 * Why this is a real risk: Zod's `.url()` validates RFC syntax, which
 * accepts `javascript:`, `data:`, `vbscript:`, `file:`, blob:`, etc.
 * A compromised merchant integration or an XSS upstream could ship a
 * session whose redirect URL executes script (or exfiltrates session
 * tokens) on every payer's browser. The damage is per-payer, but the
 * blast radius is "every checkout the merchant runs."
 *
 * Mailto / tel and other handler protocols are also rejected — there
 * is no legitimate flow on a payment checkout that would benefit.
 */
export const callbackUrlSchema = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://') || v.startsWith('http://'), {
    message: 'must be an http:// or https:// URL',
  })

export const paymentSessionSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  /**
   * On-chain StrimzRegistry merchant id (uint96) as a decimal string.
   * Set when the merchant has been registered on-chain; null when the
   * merchant exists in our DB but the registry transaction hasn't
   * been broadcast yet. Hosted checkout uses this to populate the
   * meta-tx calldata; if null, the checkout refuses to accept
   * payments.
   */
  chainMerchantId: z
    .string()
    .regex(/^[0-9]+$/u, 'must be a non-negative decimal integer string')
    .nullable(),
  /**
   * ERC-20 token contract address resolved from `currency` on the
   * active chain (Arc Testnet / Mainnet). Used as the `verifyingContract`
   * in the EIP-712 domain for both EIP-3009 and EIP-2612 signing.
   * Null on the (vanishingly unlikely) path where the API has no
   * configured address for the session's currency.
   */
  tokenAddress: evmAddressSchema.nullable(),
  customerId: idSchema.nullable(),
  status: paymentSessionStatusSchema,
  amount: tokenAmountSchema,
  currency: paymentCurrencySchema,
  feeAmount: tokenAmountSchema,
  netAmount: tokenAmountSchema,
  description: z.string().max(500).nullable(),
  payerWalletAddress: evmAddressSchema.nullable(),
  payerEmail: z.string().email().nullable(),
  successUrl: callbackUrlSchema.nullable(),
  cancelUrl: callbackUrlSchema.nullable(),
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
