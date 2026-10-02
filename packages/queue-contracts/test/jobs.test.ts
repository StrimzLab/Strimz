import { describe, expect, it } from 'vitest'
import {
  agentActionJobSchema,
  cctpBridgeJobSchema,
  relayJobSchema,
  subscriptionDueJobSchema,
  webhookDeliveryJobSchema,
} from '../src/index.js'
import {
  agentActionJobFixtures,
  cctpBridgeJobFixture,
  relayJobFixtures,
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

describe('relay submission jobs', () => {
  const reasons = Object.keys(relayJobFixtures) as Array<keyof typeof relayJobFixtures>

  it.each(reasons)('%s fixture parses and keeps its reason', (reason) => {
    expect(relayJobSchema.parse(relayJobFixtures[reason]).reason).toBe(reason)
  })

  it.each(reasons)('%s with a recorded broadcast parses', (reason) => {
    const withBroadcast = {
      ...relayJobFixtures[reason],
      broadcast: { txHash: `0x${'d'.repeat(64)}`, nonce: '12' },
    }
    expect(relayJobSchema.parse(withBroadcast).broadcast?.nonce).toBe('12')
  })

  it('rejects a registerMerchant job without the merchant id', () => {
    const { merchantInternalId: _omitted, ...rest } = relayJobFixtures.registerMerchant
    expect(relayJobSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a call job with malformed calldata or gas limit', () => {
    const base = relayJobFixtures.payWithAuthorization
    expect(relayJobSchema.safeParse({ ...base, callData: 'nope' }).success).toBe(false)
    expect(relayJobSchema.safeParse({ ...base, gasLimit: '-1' }).success).toBe(false)
  })

  it('rejects a broadcast with a short hash or a non-integer nonce', () => {
    const base = relayJobFixtures.registerMerchant
    expect(
      relayJobSchema.safeParse({ ...base, broadcast: { txHash: '0x1', nonce: '1' } }).success,
    ).toBe(false)
    expect(
      relayJobSchema.safeParse({
        ...base,
        broadcast: { txHash: `0x${'d'.repeat(64)}`, nonce: '1.5' },
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown reason', () => {
    expect(relayJobSchema.safeParse({ reason: 'drainRelayer', idempotencyKey: 'k' }).success).toBe(
      false,
    )
  })
})
