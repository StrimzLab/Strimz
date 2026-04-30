/**
 * Canonical queue names. Mirror the API's `infra/queue/queue.service.ts`
 * constants — both apps must agree on the exact strings or the scheduler
 * silently doesn't pick up the API's events.
 */
export const QUEUE_NAMES = {
  webhookDelivery: 'strimz.webhook.delivery',
  subscriptionDue: 'strimz.subscription.due',
  agentAction: 'strimz.agent.action',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
