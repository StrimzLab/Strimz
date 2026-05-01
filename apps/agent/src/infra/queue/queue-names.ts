/**
 * Canonical queue names. Shared with the scheduler — both apps must
 * agree on the exact strings or one silently doesn't pick up the
 * other's events.
 */
export const QUEUE_NAMES = {
  routingCctpBridge: 'strimz.routing.cctp.bridge',
  agentAction: 'strimz.agent.action',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
