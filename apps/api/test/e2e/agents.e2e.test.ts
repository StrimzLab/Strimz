import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'
import { must } from '../helpers/must.js'
import { agentActionJobSchema } from '@strimz/queue-contracts'
import { AgentsService } from '../../src/modules/agents/agents.service.js'

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

  async function enableCommerce(merchantId: string) {
    await t.prisma.db.agentMerchantConfig.create({
      data: { merchantId, enabledCapabilities: ['commerce'] },
    })
  }

  const jobService = () => t.app.get(AgentsService)

  it('refuses to create a job while the commerce capability is disabled', async () => {
    const m = await seedMerchant(t.prisma.db)
    await expect(
      jobService().createJob(m.id, {
        vendorAddress: '0x' + 'd'.repeat(40),
        description: 'Small task',
        amount: '10000000',
        currency: 'USDC',
      }),
    ).rejects.toMatchObject({ response: { code: 'capability_disabled' } })
    expect(await t.prisma.db.agentJob.count()).toBe(0)
    expect(t.queue.jobsFor('strimz.agent.action')).toHaveLength(0)
  })

  it('auto-approves jobs below the threshold and enqueues on-chain create', async () => {
    const m = await seedMerchant(t.prisma.db)
    await enableCommerce(m.id)
    // Default threshold (`requireHumanApprovalAboveUsdCents`) is 50_000 cents = 500 USD.
    const job = await jobService().createJob(m.id, {
      vendorAddress: '0x' + 'd'.repeat(40),
      description: 'Small task',
      amount: '10000000', // 10 USDC ⇒ well below 500 USD cap
      currency: 'USDC',
    })
    expect(job.status).toBe('accepted')
    const jobs = t.queue.jobsFor('strimz.agent.action')
    expect(jobs).toHaveLength(1)
    expect(must(jobs[0]).name).toBe('job.create-onchain')
    expect(agentActionJobSchema.parse(must(jobs[0]).data)).toEqual({
      type: 'job.create-onchain',
      jobId: job.id,
    })
  })

  it('requires human approval above threshold; approve enqueues on-chain create', async () => {
    const m = await seedMerchant(t.prisma.db)
    await enableCommerce(m.id)
    const job = await jobService().createJob(m.id, {
      vendorAddress: '0x' + 'e'.repeat(40),
      description: 'Big task',
      amount: '100000000000', // 100,000 USDC ⇒ way above cap
      currency: 'USDC',
    })
    expect(job.status).toBe('proposed')
    // No on-chain job enqueued yet.
    expect(t.queue.jobsFor('strimz.agent.action')).toHaveLength(0)

    const approved = await jobService().approveJob(m.id, job.id)
    expect(approved.status).toBe('accepted')
    const jobs = t.queue.jobsFor('strimz.agent.action')
    expect(jobs).toHaveLength(1)
    expect(agentActionJobSchema.parse(must(jobs[0]).data)).toEqual({
      type: 'job.create-onchain',
      jobId: job.id,
    })
  })
})
