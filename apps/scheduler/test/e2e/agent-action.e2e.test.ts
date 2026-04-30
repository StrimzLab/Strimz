import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { AgentActionWorker } from '../../src/workers/agent-action/agent-action.worker.js'

describe('agent-action worker e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.chain.reset()
  })

  it('subscription.cancel-onchain calls cancelSubscription with the bigint id', async () => {
    const worker = t.app.get(AgentActionWorker)
    const result = await worker.process({
      data: {
        type: 'subscription.cancel-onchain',
        subscriptionId: 'sub_x',
        onchainSubscriptionId: 99,
        merchantId: 'm_x',
        reason: null,
      },
    } as never)
    expect(result.txHash).toMatch(/^0x/)
    const calls = t.chain.callsFor('cancelSubscription')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.args[0]).toBe(99n)
  })

  it('subscription.cancel-onchain skips when on-chain id is null', async () => {
    const worker = t.app.get(AgentActionWorker)
    const result = await worker.process({
      data: {
        type: 'subscription.cancel-onchain',
        subscriptionId: 'sub_x',
        onchainSubscriptionId: null,
        merchantId: 'm_x',
        reason: null,
      },
    } as never)
    expect(result.txHash).toBe('0xskipped')
    expect(t.chain.callsFor('cancelSubscription')).toHaveLength(0)
  })

  it('job.create-onchain reads job, broadcasts, records escrowTxHash', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const job = await t.prisma.db.agentJob.create({
      data: {
        merchantId: merchant.id,
        vendorAddress: '0x' + 'a'.repeat(40),
        assessorAddress: '0x' + 'b'.repeat(40),
        description: 'spec',
        amount: '50000000',
        currency: 'USDC',
        status: 'accepted',
      },
    })

    const worker = t.app.get(AgentActionWorker)
    const result = await worker.process({
      data: { type: 'job.create-onchain', jobId: job.id },
    } as never)
    expect(result.txHash).toMatch(/^0x/)

    const calls = t.chain.callsFor('createJob')
    expect(calls).toHaveLength(1)
    const arg = calls[0]!.args[0] as { vendor: string; amount: bigint; description: string }
    expect(arg.amount).toBe(50_000_000n)
    expect(arg.description).toBe('spec')

    const updated = await t.prisma.db.agentJob.findUniqueOrThrow({ where: { id: job.id } })
    expect(updated.escrowTxHash).toBe(result.txHash)
    expect(updated.status).toBe('in_progress')
  })

  it('job.release-onchain rejects when on-chain id missing', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const job = await t.prisma.db.agentJob.create({
      data: {
        merchantId: merchant.id,
        vendorAddress: '0x' + 'a'.repeat(40),
        assessorAddress: '0x' + 'b'.repeat(40),
        description: 'spec',
        amount: '1',
        currency: 'USDC',
        status: 'approved',
      },
    })
    const worker = t.app.get(AgentActionWorker)
    await expect(
      worker.process({ data: { type: 'job.release-onchain', jobId: job.id } } as never),
    ).rejects.toThrow(/onchain id/)
  })

  it('job.dispute-onchain calls disputeJob with reason', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const job = await t.prisma.db.agentJob.create({
      data: {
        merchantId: merchant.id,
        onchainJobId: 42,
        vendorAddress: '0x' + 'a'.repeat(40),
        assessorAddress: '0x' + 'b'.repeat(40),
        description: 'spec',
        amount: '1',
        currency: 'USDC',
        status: 'in_progress',
      },
    })
    const worker = t.app.get(AgentActionWorker)
    await worker.process({
      data: { type: 'job.dispute-onchain', jobId: job.id, reason: 'bad work' },
    } as never)
    const calls = t.chain.callsFor('disputeJob')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.args[0]).toBe(42n)
    expect(calls[0]!.args[1]).toBe('bad work')
  })
})
