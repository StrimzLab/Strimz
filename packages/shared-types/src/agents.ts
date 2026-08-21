/**
 * AI AutoPay Agent. Identity, configuration, activity log, and ERC-8183 jobs.
 */

import { z } from 'zod'
import {
  evmAddressSchema,
  evmTxHashSchema,
  idSchema,
  isoTimestampSchema,
  metadataSchema,
  tokenAmountSchema,
} from './common.js'

// ---------- Identity ----------

export const agentIdentitySchema = z.object({
  id: idSchema,
  /** ERC-8004 on-chain identity address. */
  onchainAddress: evmAddressSchema,
  /** Public key or agent credential digest, as emitted by ERC-8004. */
  credentialDigest: z.string().regex(/^0x[a-fA-F0-9]+$/),
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  reputationScore: z.number().min(0).max(100).nullable(),
  registeredAt: isoTimestampSchema,
})
export type AgentIdentity = z.infer<typeof agentIdentitySchema>

// ---------- Merchant config ----------

export const agentCapabilitySchema = z.enum([
  'identity',
  'recovery',
  'routing',
  'cashflow',
  'commerce',
  'pricing_intelligence',
])
export type AgentCapability = z.infer<typeof agentCapabilitySchema>

export const agentMerchantConfigSchema = z.object({
  merchantId: idSchema,
  enabledCapabilities: z.array(agentCapabilitySchema).default([]),
  recovery: z.object({
    gracePeriodHours: z.union([z.literal(24), z.literal(48), z.literal(72)]).default(48),
    strategy: z.enum(['once', 'twice', 'until_grace_ends']).default('twice'),
    notificationTemplate: z.string().max(2000).nullable(),
  }),
  cashflow: z.object({
    digestEnabled: z.boolean().default(false),
    anomalySensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
    autoConvertToYield: z.boolean().default(false),
    minimumLiquidReserveCents: z.number().int().nonnegative().default(100_000),
  }),
  commerce: z.object({
    requireHumanApprovalAboveUsdCents: z.number().int().nonnegative().default(100_000),
    approvedVendors: z.array(evmAddressSchema).default([]),
    monthlySpendCapUsdCents: z.number().int().nonnegative().nullable(),
  }),
  updatedAt: isoTimestampSchema,
})
export type AgentMerchantConfig = z.infer<typeof agentMerchantConfigSchema>

export const updateAgentConfigInputSchema = agentMerchantConfigSchema
  .omit({ merchantId: true, updatedAt: true })
  .partial()
export type UpdateAgentConfigInput = z.infer<typeof updateAgentConfigInputSchema>

// ---------- Activity log ----------

export const agentActionTypeSchema = z.enum([
  'recovery_notification_sent',
  'recovery_retry_scheduled',
  'recovery_retry_executed',
  'recovery_abandoned',
  'routing_bridge_initiated',
  'routing_payment_completed',
  'cashflow_digest_sent',
  'cashflow_anomaly_flagged',
  'cashflow_yield_converted',
  'commerce_job_created',
  'commerce_job_approved',
  'commerce_job_completed',
  'commerce_job_disputed',
])
export type AgentActionType = z.infer<typeof agentActionTypeSchema>

export const agentActionOutcomeSchema = z.enum(['success', 'failure', 'pending', 'skipped'])
export type AgentActionOutcome = z.infer<typeof agentActionOutcomeSchema>

export const agentActivityLogSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  capability: agentCapabilitySchema,
  actionType: agentActionTypeSchema,
  outcome: agentActionOutcomeSchema,
  subscriptionId: idSchema.nullable(),
  transactionId: idSchema.nullable(),
  jobId: idSchema.nullable(),
  metadata: metadataSchema,
  createdAt: isoTimestampSchema,
})
export type AgentActivityLog = z.infer<typeof agentActivityLogSchema>

// ---------- ERC-8183 jobs ----------

// Mirrors the DB `AgentJobStatus` enum, not the contract's JobStatus.
// `accepted` is off-chain only (merchant approved, queued for on-chain
// creation); `resolved` and `reclaimed` are the escrow's terminal exits
// from a dispute and from a timeout reclaim respectively.
export const agentJobStatusSchema = z.enum([
  'proposed',
  'accepted',
  'funded',
  'in_progress',
  'delivered',
  'approved',
  'completed',
  'disputed',
  'cancelled',
  'resolved',
  'reclaimed',
])
export type AgentJobStatus = z.infer<typeof agentJobStatusSchema>

export const agentJobSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  /** On-chain job id from StrimzAgentEscrow. */
  onchainJobId: z.number().int().nonnegative().nullable(),
  vendorAddress: evmAddressSchema,
  description: z.string().min(1).max(2000),
  amount: tokenAmountSchema,
  currency: z.enum(['USDC', 'EURC']),
  status: agentJobStatusSchema,
  assessorAddress: evmAddressSchema,
  deliverableHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/)
    .nullable(),
  escrowTxHash: evmTxHashSchema.nullable(),
  releaseTxHash: evmTxHashSchema.nullable(),
  createdAt: isoTimestampSchema,
  completedAt: isoTimestampSchema.nullable(),
})
export type AgentJob = z.infer<typeof agentJobSchema>

export const createAgentJobInputSchema = z.object({
  vendorAddress: evmAddressSchema,
  description: z.string().min(1).max(2000),
  amount: tokenAmountSchema,
  currency: z.enum(['USDC', 'EURC']),
  assessorAddress: evmAddressSchema.optional(),
})
export type CreateAgentJobInput = z.infer<typeof createAgentJobInputSchema>
