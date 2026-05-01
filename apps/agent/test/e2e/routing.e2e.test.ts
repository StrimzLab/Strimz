import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { BridgeWorker } from '../../src/capabilities/routing/bridge.worker.js'
import { CircleAttestationService } from '../../src/infra/circle-attestation/circle-attestation.service.js'
import { QUEUE_NAMES } from '../../src/infra/queue/queue-names.js'

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
    attestation.fetch = async () => ({ status: 'pending_confirmations' })

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
    expect(initLog!.outcome).toBe('pending')

    const bridgeQueue: Queue = t.app.get(getQueueToken(QUEUE_NAMES.routingCctpBridge))
    const delayed = await bridgeQueue.getJobs(['delayed'])
    expect(delayed).toHaveLength(1)
  })

  it('once attestation is complete: enqueues routing.cctp.settle on agent.action', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const attestation = t.app.get(CircleAttestationService)
    attestation.fetch = async () => ({
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
    const payload = queued[0]!.data as Record<string, unknown>
    expect(payload.type).toBe('routing.cctp.settle')
    expect(payload.merchantId).toBe(merchant.id)
    expect(payload.messageHex).toMatch(/^0xbe/)

    const completedLog = await t.prisma.db.agentActivityLog.findFirst({
      where: { capability: 'routing', actionType: 'routing_payment_completed' },
    })
    expect(completedLog).not.toBeNull()
    expect(completedLog!.outcome).toBe('success')
  })

  it('on retry attempts (>= 1) does not re-record bridge_initiated', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const attestation = t.app.get(CircleAttestationService)
    attestation.fetch = async () => ({ status: 'pending_confirmations' })

    const worker = t.app.get(BridgeWorker)
    await worker.process({
      data: { merchantId: merchant.id, sourceDomainId: 6, sourceTxHash: '0x' + 'c'.repeat(64) },
      attemptsMade: 0,
    } as never)
    await worker.process({
      data: { merchantId: merchant.id, sourceDomainId: 6, sourceTxHash: '0x' + 'c'.repeat(64) },
      attemptsMade: 1,
    } as never)
    await worker.process({
      data: { merchantId: merchant.id, sourceDomainId: 6, sourceTxHash: '0x' + 'c'.repeat(64) },
      attemptsMade: 2,
    } as never)

    const initLogs = await t.prisma.db.agentActivityLog.findMany({
      where: { capability: 'routing', actionType: 'routing_bridge_initiated' },
    })
    expect(initLogs).toHaveLength(1)
  })
})
