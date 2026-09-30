export const QUEUE_NAMES = {
  webhookDelivery: 'strimz.webhook.delivery',
  subscriptionDue: 'strimz.subscription.due',
  agentAction: 'strimz.agent.action',
  routingCctpBridge: 'strimz.routing.cctp.bridge',
  relaySubmission: 'strimz.relay.submission',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
