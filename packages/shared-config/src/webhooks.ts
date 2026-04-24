/**
 * Webhook event names.
 *
 * Wire format is `<resource>.<action>`. Every event payload is versioned at
 * the envelope level so additive changes do not break consumers.
 */

export const WEBHOOK_EVENTS = {
  payment: {
    created: 'payment.created',
    completed: 'payment.completed',
    failed: 'payment.failed',
  },
  subscription: {
    created: 'subscription.created',
    charged: 'subscription.charged',
    chargeFailed: 'subscription.charge_failed',
    recoveryAttempt: 'subscription.recovery_attempt',
    recoveryOutcome: 'subscription.recovery_outcome',
    cancelled: 'subscription.cancelled',
    lapsed: 'subscription.lapsed',
  },
  refund: {
    created: 'refund.created',
    completed: 'refund.completed',
    failed: 'refund.failed',
  },
  invoice: {
    created: 'invoice.created',
    paid: 'invoice.paid',
    overdue: 'invoice.overdue',
  },
  agent: {
    actionExecuted: 'agent.action_executed',
    jobProposed: 'agent.job_proposed',
    jobCompleted: 'agent.job_completed',
    jobDisputed: 'agent.job_disputed',
  },
  compliance: {
    walletFlagged: 'compliance.wallet_flagged',
    walletBlocked: 'compliance.wallet_blocked',
  },
} as const

export type WebhookEventName =
  | (typeof WEBHOOK_EVENTS.payment)[keyof typeof WEBHOOK_EVENTS.payment]
  | (typeof WEBHOOK_EVENTS.subscription)[keyof typeof WEBHOOK_EVENTS.subscription]
  | (typeof WEBHOOK_EVENTS.refund)[keyof typeof WEBHOOK_EVENTS.refund]
  | (typeof WEBHOOK_EVENTS.invoice)[keyof typeof WEBHOOK_EVENTS.invoice]
  | (typeof WEBHOOK_EVENTS.agent)[keyof typeof WEBHOOK_EVENTS.agent]
  | (typeof WEBHOOK_EVENTS.compliance)[keyof typeof WEBHOOK_EVENTS.compliance]

export const ALL_WEBHOOK_EVENTS: readonly WebhookEventName[] = [
  ...Object.values(WEBHOOK_EVENTS.payment),
  ...Object.values(WEBHOOK_EVENTS.subscription),
  ...Object.values(WEBHOOK_EVENTS.refund),
  ...Object.values(WEBHOOK_EVENTS.invoice),
  ...Object.values(WEBHOOK_EVENTS.agent),
  ...Object.values(WEBHOOK_EVENTS.compliance),
] as const

/** Exponential backoff schedule for webhook delivery, in seconds. */
export const WEBHOOK_RETRY_SCHEDULE_SECONDS: readonly number[] = [
  60, // 1 minute
  300, // 5 minutes
  1_800, // 30 minutes
  7_200, // 2 hours
  86_400, // 24 hours
] as const

export const WEBHOOK_MAX_ATTEMPTS = WEBHOOK_RETRY_SCHEDULE_SECONDS.length + 1

/** Webhook signatures older than this are rejected to prevent replay. */
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300

/** HTTP header carrying the HMAC signature. */
export const WEBHOOK_SIGNATURE_HEADER = 'strimz-signature'

/** HTTP header carrying the unique delivery id (idempotency key for the receiver). */
export const WEBHOOK_DELIVERY_ID_HEADER = 'strimz-delivery-id'
