/**
 * Canonical webhook event envelopes.
 *
 * The event envelope is what Strimz signs, stores, and delivers. Every
 * webhook-delivered payload is an instance of `webhookEventSchema` for a
 * specific event name, with `data` typed to the matching entity schema.
 *
 * SDK consumers import `StrimzWebhookEvent` to get a discriminated union
 * over every possible event name → payload shape.
 */

import { z } from 'zod'
import { idSchema, isoTimestampSchema, modeSchema } from './common.js'
import { paymentSessionSchema } from './payment-sessions.js'
import { transactionSchema } from './transactions.js'
import { subscriptionSchema, subscriptionChargeSchema } from './subscriptions.js'
import { refundSchema } from './refunds.js'
import { invoiceSchema } from './invoices.js'
import { agentActivityLogSchema, agentJobSchema } from './agents.js'
import { complianceLogSchema } from './compliance.js'
import { webhookEventNameSchema } from './webhooks.js'

/** Common envelope wrapping every webhook payload. */
const envelope = <N extends string, D extends z.ZodTypeAny>(name: N, data: D) =>
  z.object({
    id: idSchema,
    type: z.literal(name),
    apiVersion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mode: modeSchema,
    createdAt: isoTimestampSchema,
    data,
  })

// ---------- Payment ----------

export const paymentCreatedEventSchema = envelope('payment.created', paymentSessionSchema)
export const paymentCompletedEventSchema = envelope(
  'payment.completed',
  z.object({ session: paymentSessionSchema, transaction: transactionSchema }),
)
export const paymentFailedEventSchema = envelope(
  'payment.failed',
  z.object({ session: paymentSessionSchema, reason: z.string() }),
)

// ---------- Subscription ----------

export const subscriptionCreatedEventSchema = envelope('subscription.created', subscriptionSchema)
export const subscriptionChargedEventSchema = envelope(
  'subscription.charged',
  z.object({
    subscription: subscriptionSchema,
    charge: subscriptionChargeSchema,
    transaction: transactionSchema,
  }),
)
export const subscriptionChargeFailedEventSchema = envelope(
  'subscription.charge_failed',
  z.object({ subscription: subscriptionSchema, charge: subscriptionChargeSchema }),
)
export const subscriptionRecoveryAttemptEventSchema = envelope(
  'subscription.recovery_attempt',
  z.object({ subscription: subscriptionSchema, attemptNumber: z.number().int().min(1) }),
)
export const subscriptionRecoveryOutcomeEventSchema = envelope(
  'subscription.recovery_outcome',
  z.object({
    subscription: subscriptionSchema,
    outcome: z.enum(['recovered', 'churned']),
  }),
)
export const subscriptionCancelledEventSchema = envelope(
  'subscription.cancelled',
  subscriptionSchema,
)
export const subscriptionLapsedEventSchema = envelope('subscription.lapsed', subscriptionSchema)

// ---------- Refund ----------

export const refundCreatedEventSchema = envelope('refund.created', refundSchema)
export const refundCompletedEventSchema = envelope(
  'refund.completed',
  z.object({ refund: refundSchema, transaction: transactionSchema }),
)
export const refundFailedEventSchema = envelope(
  'refund.failed',
  z.object({ refund: refundSchema, reason: z.string() }),
)

// ---------- Invoice ----------

export const invoiceCreatedEventSchema = envelope('invoice.created', invoiceSchema)
export const invoicePaidEventSchema = envelope(
  'invoice.paid',
  z.object({ invoice: invoiceSchema, transaction: transactionSchema }),
)
export const invoiceOverdueEventSchema = envelope('invoice.overdue', invoiceSchema)

// ---------- Agent ----------

export const agentActionExecutedEventSchema = envelope(
  'agent.action_executed',
  agentActivityLogSchema,
)
export const agentJobProposedEventSchema = envelope('agent.job_proposed', agentJobSchema)
export const agentJobCompletedEventSchema = envelope('agent.job_completed', agentJobSchema)
export const agentJobDisputedEventSchema = envelope('agent.job_disputed', agentJobSchema)

// ---------- Compliance ----------

export const complianceWalletFlaggedEventSchema = envelope(
  'compliance.wallet_flagged',
  complianceLogSchema,
)
export const complianceWalletBlockedEventSchema = envelope(
  'compliance.wallet_blocked',
  complianceLogSchema,
)

// ---------- Discriminated union ----------

export const webhookEventSchema = z.discriminatedUnion('type', [
  paymentCreatedEventSchema,
  paymentCompletedEventSchema,
  paymentFailedEventSchema,
  subscriptionCreatedEventSchema,
  subscriptionChargedEventSchema,
  subscriptionChargeFailedEventSchema,
  subscriptionRecoveryAttemptEventSchema,
  subscriptionRecoveryOutcomeEventSchema,
  subscriptionCancelledEventSchema,
  subscriptionLapsedEventSchema,
  refundCreatedEventSchema,
  refundCompletedEventSchema,
  refundFailedEventSchema,
  invoiceCreatedEventSchema,
  invoicePaidEventSchema,
  invoiceOverdueEventSchema,
  agentActionExecutedEventSchema,
  agentJobProposedEventSchema,
  agentJobCompletedEventSchema,
  agentJobDisputedEventSchema,
  complianceWalletFlaggedEventSchema,
  complianceWalletBlockedEventSchema,
])
export type StrimzWebhookEvent = z.infer<typeof webhookEventSchema>

/** Per-event-name inferred payload types. */
export type PaymentCreatedEvent = z.infer<typeof paymentCreatedEventSchema>
export type PaymentCompletedEvent = z.infer<typeof paymentCompletedEventSchema>
export type PaymentFailedEvent = z.infer<typeof paymentFailedEventSchema>
export type SubscriptionCreatedEvent = z.infer<typeof subscriptionCreatedEventSchema>
export type SubscriptionChargedEvent = z.infer<typeof subscriptionChargedEventSchema>
export type SubscriptionChargeFailedEvent = z.infer<typeof subscriptionChargeFailedEventSchema>
export type SubscriptionRecoveryAttemptEvent = z.infer<
  typeof subscriptionRecoveryAttemptEventSchema
>
export type SubscriptionRecoveryOutcomeEvent = z.infer<
  typeof subscriptionRecoveryOutcomeEventSchema
>
export type SubscriptionCancelledEvent = z.infer<typeof subscriptionCancelledEventSchema>
export type SubscriptionLapsedEvent = z.infer<typeof subscriptionLapsedEventSchema>
export type RefundCreatedEvent = z.infer<typeof refundCreatedEventSchema>
export type RefundCompletedEvent = z.infer<typeof refundCompletedEventSchema>
export type RefundFailedEvent = z.infer<typeof refundFailedEventSchema>
export type InvoiceCreatedEvent = z.infer<typeof invoiceCreatedEventSchema>
export type InvoicePaidEvent = z.infer<typeof invoicePaidEventSchema>
export type InvoiceOverdueEvent = z.infer<typeof invoiceOverdueEventSchema>
export type AgentActionExecutedEvent = z.infer<typeof agentActionExecutedEventSchema>
export type AgentJobProposedEvent = z.infer<typeof agentJobProposedEventSchema>
export type AgentJobCompletedEvent = z.infer<typeof agentJobCompletedEventSchema>
export type AgentJobDisputedEvent = z.infer<typeof agentJobDisputedEventSchema>
export type ComplianceWalletFlaggedEvent = z.infer<typeof complianceWalletFlaggedEventSchema>
export type ComplianceWalletBlockedEvent = z.infer<typeof complianceWalletBlockedEventSchema>

export { webhookEventNameSchema }
