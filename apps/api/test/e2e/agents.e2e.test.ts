import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

describe('agents e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.queue.reset()
  })

  it('lazy-creates config on first GET /v1/agents/config', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    const res = await t.inject({
      method: 'GET',
      url: '/v1/agents/config',
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).merchantId).toBe(m.id)
  })

  it('PATCH /v1/agents/config persists changes', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    const res = await t.inject({
      method: 'PATCH',
      url: '/v1/agents/config',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { enabledCapabilities: ['recovery', 'cashflow'] },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).enabledCapabilities).toEqual(['recovery', 'cashflow'])
  })

  it('auto-approves jobs below the threshold and enqueues on-chain create', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    // Default threshold (`requireHumanApprovalAboveUsdCents`) is 50_000 cents = 500 USD.
    const res = await t.inject({
      method: 'POST',
      url: '/v1/agents/jobs',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        vendorAddress: '0x' + 'd'.repeat(40),
        description: 'Small task',
        amount: '10000000', // 10 USDC ⇒ well below 500 USD cap
        currency: 'USDC',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).status).toBe('accepted')
    expect(t.queue.jobsFor('strimz.agent.action')).toHaveLength(1)
  })

  it('requires human approval above threshold; approve enqueues on-chain create', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    const create = await t.inject({
      method: 'POST',
      url: '/v1/agents/jobs',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        vendorAddress: '0x' + 'e'.repeat(40),
        description: 'Big task',
        amount: '100000000000', // 100,000 USDC ⇒ way above cap
        currency: 'USDC',
      },
    })
    expect(create.statusCode).toBe(201)
    const job = JSON.parse(create.body)
    expect(job.status).toBe('proposed')
    // No on-chain job enqueued yet.
    expect(t.queue.jobsFor('strimz.agent.action')).toHaveLength(0)

    const approve = await t.inject({
      method: 'POST',
      url: `/v1/agents/jobs/${job.id}/approve`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(approve.statusCode).toBe(201)
    expect(JSON.parse(approve.body).status).toBe('accepted')
    expect(t.queue.jobsFor('strimz.agent.action')).toHaveLength(1)
  })
})
