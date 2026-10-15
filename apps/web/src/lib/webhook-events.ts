import { AGENT_CAPABILITIES } from '@strimz/shared-config'
import { webhookEventNameSchema, type WebhookEventName } from '@strimz/shared-types'

export const selectableWebhookEvents: readonly WebhookEventName[] =
  webhookEventNameSchema.options.filter(
    (event) => AGENT_CAPABILITIES.commerce.available || !event.startsWith('agent.job_'),
  )
