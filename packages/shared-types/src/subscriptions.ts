/**
 * Subscriptions — plans, active subscriptions, and individual charges.
 *
 * Design notes:
 * - A SubscriptionPlan is the template a merchant defines.
 * - A Subscription is an active, customer-scoped instance of a plan.
 * - Each billing period produces a SubscriptionCharge with a unique
 *   chargeAttemptId used to enforce idempotency at the contract level.
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

// ---------- Plans ----------

export const subscriptionIntervalSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
])
export type SubscriptionInterval = z.infer<typeof subscriptionIntervalSchema>

export const subscriptionPlanStatusSchema = z.enum(['active', 'archived'])
export type SubscriptionPlanStatus = z.infer<typeof subscriptionPlanStatusSchema>

export const subscriptionPlanSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  amount: tokenAmountSchema,
  currency: paymentCurrencySchema,
  interval: subscriptionIntervalSchema,
  intervalCount: z.number().int().min(1).max(365),
  trialPeriodDays: z.number().int().min(0).max(365).nullable(),
  status: subscriptionPlanStatusSchema,
  metadata: metadataSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>

export const createSubscriptionPlanInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  amount: tokenAmountSchema,
  currency: paymentCurrencySchema,
  interval: subscriptionIntervalSchema,
  intervalCount: z.number().int().min(1).max(365).default(1),
  trialPeriodDays: z.number().int().min(0).max(365).optional(),
  metadata: metadataSchema.optional(),
})
export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanInputSchema>

// ---------- Subscriptions ----------

export const subscriptionStatusSchema = z.enum([
  'trialing',
  'active',
  'at_risk',
  'paused',
  'cancelled',
  'lapsed',
])
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>

export const subscriptionSchema = z.object({
  id: idSchema,
  onchainSubscriptionId: z.number().int().nonnegative().nullable(),
  merchantId: idSchema,
  customerId: idSchema,
  planId: idSchema,
  status: subscriptionStatusSchema,
  payerAddress: evmAddressSchema,
  currency: paymentCurrencySchema,
  amount: tokenAmountSchema,
  interval: subscriptionIntervalSchema,
  intervalCount: z.number().int().min(1),
  trialEndsAt: isoTimestampSchema.nullable(),
  currentPeriodStartAt: isoTimestampSchema,
  currentPeriodEndAt: isoTimestampSchema,
  nextChargeAt: isoTimestampSchema.nullable(),
  gracePeriodHours: z.number().int().min(0).max(72),
  cancelledAt: isoTimestampSchema.nullable(),
  metadata: metadataSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type Subscription = z.infer<typeof subscriptionSchema>

export const createSubscriptionInputSchema = z.object({
  planId: idSchema,
  customer: z.object({
    walletAddress: evmAddressSchema,
    email: z.string().email().optional(),
    externalRef: z.string().max(120).optional(),
  }),
  gracePeriodHours: z.union([z.literal(24), z.literal(48), z.literal(72)]).default(48),
  metadata: metadataSchema.optional(),
})
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionInputSchema>

export const cancelSubscriptionInputSchema = z.object({
  id: idSchema,
  reason: z.string().max(500).optional(),
})
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionInputSchema>

// ---------- Charges ----------

export const subscriptionChargeOutcomeSchema = z.enum([
  'charged',
  'insufficient_funds',
  'revoked_approval',
  'cancelled',
  'skipped',
])
export type SubscriptionChargeOutcome = z.infer<typeof subscriptionChargeOutcomeSchema>

export const subscriptionChargeStatusSchema = z.enum([
  'pending',
  'in_flight',
  'succeeded',
  'failed',
  'retrying',
  'abandoned',
])
export type SubscriptionChargeStatus = z.infer<typeof subscriptionChargeStatusSchema>

export const subscriptionChargeSchema = z.object({
  id: idSchema,
  subscriptionId: idSchema,
  merchantId: idSchema,
  chargeAttemptId: z.string().length(66, 'must be a 32-byte 0x-prefixed hex string'),
  periodStartAt: isoTimestampSchema,
  periodEndAt: isoTimestampSchema,
  amount: tokenAmountSchema,
  currency: paymentCurrencySchema,
  status: subscriptionChargeStatusSchema,
  outcome: subscriptionChargeOutcomeSchema.nullable(),
  attemptNumber: z.number().int().min(1),
  scheduledAt: isoTimestampSchema,
  executedAt: isoTimestampSchema.nullable(),
  onchainTxHash: evmTxHashSchema.nullable(),
  failureReason: z.string().max(500).nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type SubscriptionCharge = z.infer<typeof subscriptionChargeSchema>
