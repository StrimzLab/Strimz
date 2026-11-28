export const QUEUE_NAMES = {
  webhookDelivery: 'strimz.webhook.delivery',
  subscriptionDue: 'strimz.subscription.due',
  agentAction: 'strimz.agent.action',
  routingCctpBridge: 'strimz.routing.cctp.bridge',
  relaySubmission: 'strimz.relay.submission',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

/**
 * BullMQ options for a relay submission. Shared so the API and the scheduler's registration
 * retry queue the same way (ADR-2026-11-28-registration-retry).
 */
export function relaySubmissionJobOptions(jobId: string, delayMs = 0) {
  return {
    jobId,
    delay: delayMs,
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 3600 },
  }
}
