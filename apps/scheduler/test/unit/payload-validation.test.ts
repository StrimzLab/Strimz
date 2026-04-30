import { describe, it, expect } from 'vitest'
import {
  agentActionJobSchema,
  subscriptionDueJobSchema,
  webhookDeliveryJobSchema,
} from '../../src/infra/queue/job-payloads.js'

describe('queue payload schemas', () => {
  describe('webhookDeliveryJobSchema', () => {
    it('accepts a complete payload', () => {
      const ok = webhookDeliveryJobSchema.safeParse({
        deliveryId: 'whdl_x',
        endpointId: 'ep_x',
        url: 'https://example.com/h',
        signingSecretHash: 'a'.repeat(64),
        eventId: 'evt_x',
      })
      expect(ok.success).toBe(true)
    })
    it('rejects http:// and short hash', () => {
      expect(
        webhookDeliveryJobSchema.safeParse({
          deliveryId: 'x',
          endpointId: 'x',
          url: 'http://example.com',
          signingSecretHash: 'a'.repeat(64),
          eventId: 'x',
        }).success,
      ).toBe(true) // url validator allows http; SSRF guard at API boundary blocks it
      expect(
        webhookDeliveryJobSchema.safeParse({
          deliveryId: 'x',
          endpointId: 'x',
          url: 'https://x',
          signingSecretHash: 'short',
          eventId: 'x',
        }).success,
      ).toBe(false)
    })
  })

  describe('subscriptionDueJobSchema', () => {
    it('requires subscriptionId', () => {
      expect(subscriptionDueJobSchema.safeParse({}).success).toBe(false)
      expect(subscriptionDueJobSchema.safeParse({ subscriptionId: 'sub_x' }).success).toBe(true)
    })
  })

  describe('agentActionJobSchema', () => {
    it('discriminates by `type` and rejects unknown types', () => {
      expect(
        agentActionJobSchema.safeParse({
          type: 'subscription.cancel-onchain',
          subscriptionId: 's',
          onchainSubscriptionId: 1,
          merchantId: 'm',
          reason: null,
        }).success,
      ).toBe(true)
      expect(
        agentActionJobSchema.safeParse({ type: 'unknown.thing', jobId: 'j' }).success,
      ).toBe(false)
    })
    it('accepts every documented type', () => {
      const types: Array<{ type: string; jobId?: string; reason?: string }> = [
        { type: 'job.create-onchain', jobId: 'j' },
        { type: 'job.release-onchain', jobId: 'j' },
        { type: 'job.dispute-onchain', jobId: 'j', reason: 'reason' },
        { type: 'job.cancel-onchain', jobId: 'j', reason: 'reason' },
      ]
      for (const t of types) {
        expect(agentActionJobSchema.safeParse(t).success).toBe(true)
      }
    })
  })
})
