import { AGENT_CAPABILITIES } from '@strimz/shared-config'
import { webhookEventNameSchema, type WebhookEventName } from '@strimz/shared-types'

// Nothing emits these until wallet screening ships.
export const comingSoonWebhookEvents: readonly WebhookEventName[] =
  webhookEventNameSchema.options.filter((event) => event.startsWith('compliance.'))

export const selectableWebhookEvents: readonly WebhookEventName[] =
  webhookEventNameSchema.options.filter(
    (event) =>
      !comingSoonWebhookEvents.includes(event) &&
      (AGENT_CAPABILITIES.commerce.available || !event.startsWith('agent.job_')),
  )
