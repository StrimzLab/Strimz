import { describe, expect, it } from 'vitest'
import { WebhookEventName } from '@strimz/db'
import { ALL_WEBHOOK_EVENTS } from '@strimz/shared-config'
import { webhookEventNameSchema } from '@strimz/shared-types'

describe('webhook event names', () => {
  const wire = [...webhookEventNameSchema.options].sort()

  it('match the database enum', () => {
    const db = Object.values(WebhookEventName)
      .map((name) => name.replace('_', '.'))
      .sort()
    expect(db).toEqual(wire)
  })

  it('match the shared config list', () => {
    expect([...ALL_WEBHOOK_EVENTS].sort()).toEqual(wire)
  })

  it.each(['subscription.recovery_outcome', 'agent.action_executed'])(
    'no longer list %s, which nothing sends',
    (name) => {
      expect(webhookEventNameSchema.safeParse(name).success).toBe(false)
    },
  )

  // The refund reconciler sends it since ADR-2026-11-13-refund-failures (#440).
  it('lists refund.failed', () => {
    expect(webhookEventNameSchema.safeParse('refund.failed').success).toBe(true)
  })
})
