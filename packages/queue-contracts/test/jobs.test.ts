import { describe, expect, it } from 'vitest'
import {
  agentActionJobSchema,
  cctpBridgeJobSchema,
  subscriptionDueJobSchema,
  webhookDeliveryJobSchema,
} from '../src/index.js'
import {
  agentActionJobFixtures,
  cctpBridgeJobFixture,
  subscriptionDueJobFixture,
  webhookDeliveryJobFixture,
} from '../src/fixtures.js'

describe('agent action jobs', () => {
  const types = Object.keys(agentActionJobFixtures) as Array<keyof typeof agentActionJobFixtures>

  it.each(types)('%s fixture parses and keeps its type', (type) => {
    const parsed = agentActionJobSchema.parse(agentActionJobFixtures[type])
    expect(parsed.type).toBe(type)
  })

  it.each(types)('%s without the type field is rejected', (type) => {
    const { type: _omitted, ...rest } = agentActionJobFixtures[type]
    expect(agentActionJobSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects an unknown type', () => {
    expect(agentActionJobSchema.safeParse({ type: 'unknown.thing', jobId: 'j' }).success).toBe(
      false,
    )
  })

  it('requires the fields of each arm', () => {
    expect(agentActionJobSchema.safeParse({ type: 'job.create-onchain' }).success).toBe(false)
    expect(
      agentActionJobSchema.safeParse({ type: 'job.dispute-onchain', jobId: 'j' }).success,
    ).toBe(false)
    expect(
      agentActionJobSchema.safeParse({
        type: 'subscription.cancel-onchain',
        subscriptionId: 's',
        merchantId: 'm',
      }).success,
    ).toBe(false)
    expect(
      agentActionJobSchema.safeParse({
        ...agentActionJobFixtures['routing.cctp.settle'],
        messageHex: 'not-hex',
      }).success,
    ).toBe(false)
  })
})

describe('other jobs', () => {
  it('webhook delivery fixture parses and a short secret hash is rejected', () => {
    expect(webhookDeliveryJobSchema.parse(webhookDeliveryJobFixture)).toEqual(
      webhookDeliveryJobFixture,
    )
    expect(
      webhookDeliveryJobSchema.safeParse({
        ...webhookDeliveryJobFixture,
        signingSecretHash: 'short',
      }).success,
    ).toBe(false)
  })

  it('subscription due fixture parses and an empty payload is rejected', () => {
    expect(subscriptionDueJobSchema.parse(subscriptionDueJobFixture)).toEqual(
      subscriptionDueJobFixture,
    )
    expect(subscriptionDueJobSchema.safeParse({}).success).toBe(false)
  })

  it('cctp bridge fixture parses, pollCount defaults to 0, bad tx hash is rejected', () => {
    expect(cctpBridgeJobSchema.parse(cctpBridgeJobFixture)).toEqual(cctpBridgeJobFixture)
    const { pollCount: _omitted, ...withoutPoll } = cctpBridgeJobFixture
    expect(cctpBridgeJobSchema.parse(withoutPoll).pollCount).toBe(0)
    expect(
      cctpBridgeJobSchema.safeParse({ ...cctpBridgeJobFixture, sourceTxHash: '0x1' }).success,
    ).toBe(false)
  })
})
