/**
 * Webhook utilities. Re-exports the verified Web Crypto primitives from
 * `@strimz/shared-crypto` and the typed event union from
 * `@strimz/shared-types`. Consumers should import from here, not directly
 * from the shared packages.
 */

export {
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_SIGNATURE_VERSION,
  type SignWebhookOptions,
  type VerifyWebhookOptions,
  type VerifyWebhookReason,
  type VerifyWebhookResult,
} from '@strimz/shared-crypto'

export {
  webhookEventSchema,
  webhookEventNameSchema,
  type StrimzWebhookEvent,
  type WebhookEventName,
  // Per-event typed payloads.
  type PaymentCreatedEvent,
  type PaymentCompletedEvent,
  type PaymentFailedEvent,
  type SubscriptionCreatedEvent,
  type SubscriptionChargedEvent,
  type SubscriptionChargeFailedEvent,
  type SubscriptionRecoveryAttemptEvent,
  type SubscriptionRecoveryOutcomeEvent,
  type SubscriptionCancelledEvent,
  type SubscriptionLapsedEvent,
  type RefundCreatedEvent,
  type RefundCompletedEvent,
  type RefundFailedEvent,
  type InvoiceCreatedEvent,
  type InvoicePaidEvent,
  type InvoiceOverdueEvent,
  type AgentActionExecutedEvent,
  type AgentJobProposedEvent,
  type AgentJobCompletedEvent,
  type AgentJobDisputedEvent,
  type ComplianceWalletFlaggedEvent,
  type ComplianceWalletBlockedEvent,
} from '@strimz/shared-types'

export {
  WEBHOOK_RETRY_SCHEDULE_SECONDS,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_DELIVERY_ID_HEADER,
} from '@strimz/shared-config'

import { webhookEventSchema, type StrimzWebhookEvent } from '@strimz/shared-types'

/**
 * Parse a webhook payload into a typed `StrimzWebhookEvent`.
 * Use after `verifyWebhookSignature` succeeds. Never trust raw payloads.
 */
export function parseWebhookEvent(rawJson: string): StrimzWebhookEvent {
  return webhookEventSchema.parse(JSON.parse(rawJson))
}
