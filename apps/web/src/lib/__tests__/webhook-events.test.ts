import { describe, expect, it } from 'vitest'
import { webhookEventNameSchema } from '@strimz/shared-types'

import { selectableWebhookEvents } from '../webhook-events'

describe('selectable webhook events', () => {
  it('leaves out the escrow job events while agent escrow is unavailable', () => {
    for (const event of ['agent.job_proposed', 'agent.job_completed', 'agent.job_disputed']) {
      expect(selectableWebhookEvents).not.toContain(event)
    }
  })

  it('offers every other event', () => {
    const others = webhookEventNameSchema.options.filter((e) => !e.startsWith('agent.job_'))
    expect(selectableWebhookEvents).toEqual(others)
  })
})
