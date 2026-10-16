import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { BridgeWorker } from '../../src/capabilities/routing/bridge.worker.js'
import { CircleAttestationService } from '../../src/infra/circle-attestation/circle-attestation.service.js'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { must } from '../helpers/must.js'

describe('routing CCTP bridge worker e2e', () => {
  let t: TestApp
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    const bridge: Queue = t.app.get(getQueueToken(QUEUE_NAMES.routingCctpBridge))
    const action: Queue = t.app.get(getQueueToken(QUEUE_NAMES.agentAction))
    await Promise.all([bridge.drain(true), action.drain(true)])
  })

  it('on first attestation poll: records bridge_initiated and re-enqueues self when pending', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const attestation = t.app.get(CircleAttestationService)
    attestation.fetch = () => Promise.resolve({ status: 'pending_confirmations' })

    const worker = t.app.get(BridgeWorker)
    const result = await worker.process({
      data: {
        merchantId: merchant.id,
        sourceDomainId: 6, // Base
        sourceTxHash: '0x' + 'a'.repeat(64),
        ref: 'sess_abc',
      },
      attemptsMade: 0,
    } as never)
    expect(result.status).toBe('pending')

    const initLog = await t.prisma.db.agentActivityLog.findFirst({
      where: { capability: 'routing', actionType: 'routing_bridge_initiated' },
    })
    expect(initLog).not.toBeNull()
    expect(must(initLog).outcome).toBe('pending')

    const bridgeQueue: Queue = t.app.get(getQueueToken(QUEUE_NAMES.routingCctpBridge))
    const delayed = await bridgeQueue.getJobs(['delayed'])
    expect(delayed).toHaveLength(1)
    expect(must(delayed[0]).data).toMatchObject({
      merchantId: merchant.id,
      sourceTxHash: '0x' + 'a'.repeat(64),
      pollCount: 1,
    })
  })

  it('once attestation is complete: enqueues routing.cctp.settle on agent.action', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const attestation = t.app.get(CircleAttestationService)
    attestation.fetch = () =>
      Promise.resolve({
        status: 'complete',
        messageHex: ('0x' + 'be'.repeat(80)) as `0x${string}`,
        attestationHex: ('0x' + '12'.repeat(65)) as `0x${string}`,
      })

    const worker = t.app.get(BridgeWorker)
    const result = await worker.process({
      data: {
        merchantId: merchant.id,
        sourceDomainId: 6,
        sourceTxHash: '0x' + 'b'.repeat(64),
      },
      attemptsMade: 0,
    } as never)
    expect(result.status).toBe('queued')

    const actionQueue: Queue = t.app.get(getQueueToken(QUEUE_NAMES.agentAction))
    const queued = await actionQueue.getJobs(['waiting', 'active', 'delayed'])
    expect(queued).toHaveLength(1)
    const payload = must(queued[0]).data as Record<string, unknown>
    expect(payload.type).toBe('routing.cctp.settle')
    expect(payload.merchantId).toBe(merchant.id)
    expect(payload.messageHex).toMatch(/^0xbe/)

    const completedLog = await t.prisma.db.agentActivityLog.findFirst({
      where: { capability: 'routing', actionType: 'routing_payment_completed' },
    })
    expect(completedLog).not.toBeNull()
    expect(must(completedLog).outcome).toBe('success')
  })

  it('records bridge_initiated once across repeated polls of the same bridge', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const attestation = t.app.get(CircleAttestationService)
    attestation.fetch = () => Promise.resolve({ status: 'pending_confirmations' })

    const worker = t.app.get(BridgeWorker)
    const bridgeQueue: Queue = t.app.get(getQueueToken(QUEUE_NAMES.routingCctpBridge))
    await worker.process({
      data: { merchantId: merchant.id, sourceDomainId: 6, sourceTxHash: '0x' + 'c'.repeat(64) },
    } as never)
    for (let poll = 1; poll <= 2; poll++) {
      const [requeued] = await bridgeQueue.getJobs(['delayed'])
      const data = must(requeued).data as { pollCount: number }
      expect(data.pollCount).toBe(poll)
      await bridgeQueue.drain(true)
      await worker.process({ data } as never)
    }

    const initLogs = await t.prisma.db.agentActivityLog.findMany({
      where: { capability: 'routing', actionType: 'routing_bridge_initiated' },
    })
    expect(initLogs).toHaveLength(1)
    expect(must(initLogs[0]).outcome).toBe('pending')
  })

  it('stops polling and records a failure when the attestation never arrives', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const attestation = t.app.get(CircleAttestationService)
    attestation.fetch = () => Promise.resolve({ status: 'pending_confirmations' })

    const worker = t.app.get(BridgeWorker)
    const result = await worker.process({
      data: {
        merchantId: merchant.id,
        sourceDomainId: 6,
        sourceTxHash: '0x' + 'd'.repeat(64),
        pollCount: 120,
      },
    } as never)
    expect(result.status).toBe('pending')

    const bridgeQueue: Queue = t.app.get(getQueueToken(QUEUE_NAMES.routingCctpBridge))
    expect(await bridgeQueue.getJobs(['delayed', 'waiting', 'active'])).toHaveLength(0)

    const logs = await t.prisma.db.agentActivityLog.findMany({ where: { capability: 'routing' } })
    expect(logs).toHaveLength(1)
    expect(must(logs[0])).toMatchObject({
      actionType: 'routing_bridge_initiated',
      outcome: 'failure',
      metadata: { reason: 'attestation timed out' },
    })
  })
})
