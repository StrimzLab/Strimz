import { describe, expect, it } from 'vitest'
import { webhookEventNameSchema } from '@strimz/shared-types'

import { comingSoonWebhookEvents, selectableWebhookEvents } from '../webhook-events'

describe('selectable webhook events', () => {
  it('leaves out the escrow job events while agent escrow is unavailable', () => {
    for (const event of ['agent.job_proposed', 'agent.job_completed', 'agent.job_disputed']) {
      expect(selectableWebhookEvents).not.toContain(event)
      expect(comingSoonWebhookEvents).not.toContain(event)
    }
  })

  it('shows the compliance events as coming soon, not selectable', () => {
    expect(comingSoonWebhookEvents).toEqual([
      'compliance.wallet_flagged',
      'compliance.wallet_blocked',
    ])
    for (const event of comingSoonWebhookEvents) {
      expect(selectableWebhookEvents).not.toContain(event)
    }
  })

  it('offers every other event', () => {
    const others = webhookEventNameSchema.options.filter(
      (e) => !e.startsWith('agent.job_') && !e.startsWith('compliance.'),
    )
    expect(selectableWebhookEvents).toEqual(others)
  })
})
