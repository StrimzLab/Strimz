/**
 * Compliance: sanctions/AML screening log.
 *
 * Every wallet address that interacts with Strimz (merchant payout,
 * subscriber, payer) is screened. Results are logged; provider and score
 * are recorded for later audit.
 */

import { z } from 'zod'
import { evmAddressSchema, idSchema, isoTimestampSchema } from './common.js'

export const complianceProviderSchema = z.enum(['trm', 'elliptic', 'disabled'])
export type ComplianceProvider = z.infer<typeof complianceProviderSchema>

export const complianceStatusSchema = z.enum(['clear', 'flagged', 'blocked', 'error'])
export type ComplianceStatus = z.infer<typeof complianceStatusSchema>

export const complianceScreeningContextSchema = z.enum([
  'merchant_onboarding',
  'payer_checkout',
  'subscriber_signup',
  'refund_recipient',
])
export type ComplianceScreeningContext = z.infer<typeof complianceScreeningContextSchema>

export const complianceLogSchema = z.object({
  id: idSchema,
  walletAddress: evmAddressSchema,
  provider: complianceProviderSchema,
  status: complianceStatusSchema,
  riskScore: z.number().min(0).max(100).nullable(),
  flags: z.array(z.string().max(120)).default([]),
  context: complianceScreeningContextSchema,
  merchantId: idSchema.nullable(),
  sessionId: idSchema.nullable(),
  subscriptionId: idSchema.nullable(),
  providerRequestId: z.string().max(200).nullable(),
  createdAt: isoTimestampSchema,
})
export type ComplianceLog = z.infer<typeof complianceLogSchema>
