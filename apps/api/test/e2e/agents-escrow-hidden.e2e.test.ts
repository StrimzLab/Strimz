import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

const JOB = {
  vendorAddress: '0x' + 'd'.repeat(40),
  description: 'Small task',
  amount: '10000000',
  currency: 'USDC',
}

describe('agent escrow is unavailable for launch', () => {
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

  async function merchantWithKey(storedCapabilities: string[] | null = null) {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    if (storedCapabilities) {
      await t.prisma.db.agentMerchantConfig.create({
        data: { merchantId: m.id, enabledCapabilities: storedCapabilities as never },
      })
    }
    return { merchantId: m.id, key: k.secretKey }
  }

  const call = (key: string, method: 'POST' | 'PATCH', url: string, payload: object) =>
    t.inject({ method, url, headers: { authorization: `Bearer ${key}` }, payload: { ...payload } })

  const errorCode = (body: string) => (JSON.parse(body) as { error: { code: string } }).error.code

  it('refuses to turn on commerce and stores nothing', async () => {
    const { merchantId, key } = await merchantWithKey()

    const res = await call(key, 'PATCH', '/v1/agents/config', {
      enabledCapabilities: ['recovery', 'commerce'],
    })

    expect(res.statusCode).toBe(403)
    expect(errorCode(res.body)).toBe('capability_unavailable')
    const stored = await t.prisma.db.agentMerchantConfig.findUnique({ where: { merchantId } })
    expect(stored?.enabledCapabilities ?? []).toEqual([])
  })

  it('still turns on routing, which this change leaves alone', async () => {
    const { key } = await merchantWithKey()
    const res = await call(key, 'PATCH', '/v1/agents/config', {
      enabledCapabilities: ['routing'],
    })
    expect(res.statusCode).toBe(200)
  })

  it('lets a merchant with commerce already stored save other settings and turn it off', async () => {
    const { merchantId, key } = await merchantWithKey(['recovery', 'commerce'])

    const keep = await call(key, 'PATCH', '/v1/agents/config', {
      enabledCapabilities: ['recovery', 'commerce', 'cashflow'],
    })
    expect(keep.statusCode).toBe(200)

    const off = await call(key, 'PATCH', '/v1/agents/config', {
      enabledCapabilities: ['recovery', 'cashflow'],
    })
    expect(off.statusCode).toBe(200)
    const stored = await t.prisma.db.agentMerchantConfig.findUniqueOrThrow({
      where: { merchantId },
    })
    expect(stored.enabledCapabilities).toEqual(['recovery', 'cashflow'])
  })

  it('refuses to create a job even with commerce stored, and writes or queues nothing', async () => {
    const { key } = await merchantWithKey(['commerce'])

    const res = await call(key, 'POST', '/v1/agents/jobs', JOB)

    expect(res.statusCode).toBe(403)
    expect(errorCode(res.body)).toBe('capability_unavailable')
    expect(await t.prisma.db.agentJob.count()).toBe(0)
    expect(t.queue.jobsFor('strimz.agent.action')).toHaveLength(0)
  })

  it('refuses to approve a job and queues nothing', async () => {
    const { merchantId, key } = await merchantWithKey(['commerce'])
    const job = await t.prisma.db.agentJob.create({
      data: {
        merchantId,
        vendorAddress: JOB.vendorAddress,
        description: 'Big task',
        amount: '100000000000',
        currency: 'USDC',
        assessorAddress: '0x000000000000000000000000000000000000beef',
        status: 'proposed',
      },
    })

    const res = await call(key, 'POST', `/v1/agents/jobs/${job.id}/approve`, {})

    expect(res.statusCode).toBe(403)
    expect(errorCode(res.body)).toBe('capability_unavailable')
    const after = await t.prisma.db.agentJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(after.status).toBe('proposed')
    expect(t.queue.jobsFor('strimz.agent.action')).toHaveLength(0)
  })

  it('still lists jobs', async () => {
    const { key } = await merchantWithKey()
    const res = await t.inject({
      method: 'GET',
      url: '/v1/agents/jobs',
      headers: { authorization: `Bearer ${key}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).data).toEqual([])
  })
})
