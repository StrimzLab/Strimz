import { beforeEach, describe, expect, it } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { CCTP_DOMAIN_IDS } from '@strimz/shared-config'

import { RelayService } from '../../../../src/modules/relay/relay.service.js'
import { QUEUE_NAMES } from '../../../../src/infra/queue/queue.service.js'
import type { QueueService } from '../../../../src/infra/queue/queue.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'

/**
 * Cross-chain funding: `getCctpBridgeState` (the preflight the checkout
 * runs before the payer burns anything) and `submitCctpBridge` (the
 * record-and-relay the checkout runs after).
 *
 * The asymmetry is the point. Everything that can refuse a payer lives
 * in the preflight, because after the burn they have spent real money.
 */

const BURN_HASH = `0x${'ab'.repeat(32)}` as `0x${string}`
const OTHER_HASH = `0x${'cd'.repeat(32)}` as `0x${string}`

interface SessionRow {
  id: string
  merchantId: string
  status: string
  amount: string
  expiresAt: Date | null
  sourceChain: string | null
  bridgeTxHash: string | null
  merchant: { onchainMerchantId: number | null }
}

function sessionRow(over: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'ses_1',
    merchantId: 'mch_internal_1',
    status: 'created',
    amount: '50000000',
    expiresAt: new Date(Date.now() + 60 * 60_000),
    sourceChain: null,
    bridgeTxHash: null,
    merchant: { onchainMerchantId: 7 },
    ...over,
  }
}

/**
 * Fake BullMQ queue mirroring the duplicate-id rejection the real one
 * documents. `submitCctpBridge` must swallow that — a retried POST of
 * the same burn is the client doing the right thing.
 */
function makeFakeQueueService() {
  const jobs = new Map<string, { name: string; data: unknown; opts: { jobId?: string } }>()
  const queue = {
    async add(name: string, data: unknown, opts: { jobId?: string }) {
      const id = opts.jobId ?? `auto-${jobs.size}`
      if (jobs.has(id)) {
        const err: Error & { code?: string } = new Error(`Job ${id} already exists`)
        err.code = 'DUPLICATE_JOB'
        throw err
      }
      jobs.set(id, { name, data, opts })
      return { id, data }
    },
    async getJob(id: string) {
      const entry = jobs.get(id)
      return entry ? { id, data: entry.data } : null
    },
    _jobs: jobs,
  }
  const names: string[] = []
  const queueService = {
    queue: (n: string) => {
      names.push(n)
      return queue
    },
  } as unknown as QueueService
  return { queueService, queue, names }
}

function makeFakePrisma(row: SessionRow | null) {
  const updates: { where: unknown; data: Record<string, unknown> }[] = []
  const prisma = {
    db: {
      paymentSession: {
        findUnique: async () => row,
        update: async (args: { where: unknown; data: Record<string, unknown> }) => {
          updates.push(args)
          return row
        },
      },
      subscription: { findFirst: async () => null },
    },
  } as unknown as PrismaService
  return { prisma, updates }
}

function makeCfg(): TypedConfigService {
  return {
    env: {
      STRIMZ_PAYMENTS_ADDRESS: '0x1111111111111111111111111111111111111111',
      STRIMZ_SUBSCRIPTIONS_ADDRESS: '0x2222222222222222222222222222222222222222',
    },
  } as unknown as TypedConfigService
}

function makeService(row: SessionRow | null) {
  const { queueService, queue, names } = makeFakeQueueService()
  const { prisma, updates } = makeFakePrisma(row)
  const svc = new RelayService(queueService, prisma, makeCfg())
  return { svc, queue, names, updates }
}

describe('getCctpBridgeState', () => {
  it('rejects an unknown session', async () => {
    const { svc } = makeService(null)
    await expect(svc.getCctpBridgeState('nope')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('marks a live session fundable', async () => {
    const { svc } = makeService(sessionRow())
    const state = await svc.getCctpBridgeState('ses_1')
    expect(state.fundable).toBe(true)
    expect(state.reason).toBeNull()
  })

  it('reports the gross amount the payer must reach on Arc', async () => {
    const { svc } = makeService(sessionRow({ amount: '1234567' }))
    expect((await svc.getCctpBridgeState('ses_1')).amount).toBe('1234567')
  })

  it('passes through an in-flight bridge so the checkout can resume', async () => {
    const { svc } = makeService(sessionRow({ sourceChain: 'arbitrum', bridgeTxHash: BURN_HASH }))
    const state = await svc.getCctpBridgeState('ses_1')
    expect(state.sourceChain).toBe('arbitrum')
    expect(state.bridgeTxHash).toBe(BURN_HASH)
  })

  // Each of these would leave the payer with USDC on Arc and no way to
  // spend it on this session, so they must be caught before the burn.
  it.each([
    ['confirmed', /already paid/i],
    ['cancelled', /cancelled/i],
    ['expired', /expired/i],
    ['failed', /failed/i],
  ])('blocks a %s session', async (status, pattern) => {
    const { svc } = makeService(sessionRow({ status }))
    const state = await svc.getCctpBridgeState('ses_1')
    expect(state.fundable).toBe(false)
    expect(state.reason).toMatch(pattern)
  })

  it('blocks a session past its expiry', async () => {
    const { svc } = makeService(sessionRow({ expiresAt: new Date(Date.now() - 1000) }))
    const state = await svc.getCctpBridgeState('ses_1')
    expect(state.fundable).toBe(false)
    expect(state.reason).toMatch(/expired/i)
  })

  it('allows a session with no expiry', async () => {
    const { svc } = makeService(sessionRow({ expiresAt: null }))
    expect((await svc.getCctpBridgeState('ses_1')).fundable).toBe(true)
  })

  it('blocks when the merchant has no on-chain id', async () => {
    // Without a registry id the payment can never be relayed, so
    // bridging would strand the funds.
    const { svc } = makeService(sessionRow({ merchant: { onchainMerchantId: null } }))
    const state = await svc.getCctpBridgeState('ses_1')
    expect(state.fundable).toBe(false)
    expect(state.reason).toMatch(/on-chain/i)
  })

  it('reports the unregistered merchant ahead of the session status', async () => {
    const { svc } = makeService(
      sessionRow({ status: 'cancelled', merchant: { onchainMerchantId: null } }),
    )
    expect((await svc.getCctpBridgeState('ses_1')).reason).toMatch(/on-chain/i)
  })

  it('never mutates the session', async () => {
    const { svc, updates } = makeService(sessionRow())
    await svc.getCctpBridgeState('ses_1')
    expect(updates).toHaveLength(0)
  })
})

describe('submitCctpBridge', () => {
  it('rejects an unknown session', async () => {
    const { svc } = makeService(null)
    await expect(
      svc.submitCctpBridge({ sessionId: 'nope', sourceChain: 'arbitrum', burnTxHash: BURN_HASH }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('stamps sourceChain and bridgeTxHash on the session', async () => {
    const { svc, updates } = makeService(sessionRow())
    await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    expect(updates).toHaveLength(1)
    expect(updates[0].data).toEqual({ sourceChain: 'arbitrum', bridgeTxHash: BURN_HASH })
  })

  it('enqueues onto the queue the agent consumes', async () => {
    const { svc, names } = makeService(sessionRow())
    await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    expect(names).toContain(QUEUE_NAMES.routingCctpBridge)
    expect(QUEUE_NAMES.routingCctpBridge).toBe('strimz.routing.cctp.bridge')
  })

  it('builds the payload the agent bridge worker expects', async () => {
    const { svc, queue } = makeService(sessionRow())
    await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    const job = queue._jobs.get(`cctp:${BURN_HASH}`)
    expect(job?.data).toEqual({
      // Off-chain Strimz merchant id, not the registry id.
      merchantId: 'mch_internal_1',
      sourceDomainId: CCTP_DOMAIN_IDS.arbitrum,
      sourceTxHash: BURN_HASH,
      // The worker echoes `ref` so the dashboard links back.
      ref: 'ses_1',
      pollCount: 0,
    })
  })

  it('keys the job on the burn hash', async () => {
    const { svc, queue } = makeService(sessionRow())
    await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    expect([...queue._jobs.keys()]).toEqual([`cctp:${BURN_HASH}`])
  })

  it.each(['arbitrum', 'base', 'ethereum', 'polygon', 'optimism', 'avalanche'] as const)(
    'maps %s to its CCTP domain',
    async (chain) => {
      const { svc, queue } = makeService(sessionRow())
      await svc.submitCctpBridge({ sessionId: 'ses_1', sourceChain: chain, burnTxHash: BURN_HASH })
      const job = queue._jobs.get(`cctp:${BURN_HASH}`)
      expect((job?.data as { sourceDomainId: number }).sourceDomainId).toBe(CCTP_DOMAIN_IDS[chain])
    },
  )

  it('never targets Arc as the source domain', async () => {
    const { svc, queue } = makeService(sessionRow())
    await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    const job = queue._jobs.get(`cctp:${BURN_HASH}`)
    expect((job?.data as { sourceDomainId: number }).sourceDomainId).not.toBe(CCTP_DOMAIN_IDS.arc)
  })

  it('is idempotent when the same burn is posted twice', async () => {
    // The client retrying a dropped response must not 500 — the funds
    // are already in flight and there is nothing for the payer to redo.
    const row = sessionRow()
    const { svc, queue } = makeService(row)
    await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    row.bridgeTxHash = BURN_HASH
    await expect(
      svc.submitCctpBridge({ sessionId: 'ses_1', sourceChain: 'arbitrum', burnTxHash: BURN_HASH }),
    ).resolves.toBeDefined()
    expect(queue._jobs.size).toBe(1)
  })

  it('refuses a second, different burn on one session', async () => {
    const { svc } = makeService(sessionRow({ bridgeTxHash: BURN_HASH }))
    await expect(
      svc.submitCctpBridge({ sessionId: 'ses_1', sourceChain: 'arbitrum', burnTxHash: OTHER_HASH }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('does not enqueue when it refuses a conflicting burn', async () => {
    const { svc, queue } = makeService(sessionRow({ bridgeTxHash: BURN_HASH }))
    await svc
      .submitCctpBridge({ sessionId: 'ses_1', sourceChain: 'arbitrum', burnTxHash: OTHER_HASH })
      .catch(() => undefined)
    expect(queue._jobs.size).toBe(0)
  })

  it('relays a session that expired mid-burn', async () => {
    // Deliberate: the payer has already spent. The mint lands at their
    // own address either way, so refusing to relay would strand them
    // for no benefit.
    const { svc, queue } = makeService(sessionRow({ expiresAt: new Date(Date.now() - 1000) }))
    const state = await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    expect(queue._jobs.size).toBe(1)
    expect(state.fundable).toBe(false)
    expect(state.reason).toMatch(/expired/i)
  })

  it('returns the post-write state', async () => {
    const row = sessionRow()
    const { svc } = makeService(row)
    row.sourceChain = 'arbitrum'
    row.bridgeTxHash = BURN_HASH
    const state = await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    expect(state.sourceChain).toBe('arbitrum')
    expect(state.bridgeTxHash).toBe(BURN_HASH)
  })
})

describe('submitCctpBridge under load', () => {
  it('collapses 50 concurrent posts of one burn into a single job', async () => {
    const { svc, queue } = makeService(sessionRow())
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () =>
        svc.submitCctpBridge({
          sessionId: 'ses_1',
          sourceChain: 'arbitrum',
          burnTxHash: BURN_HASH,
        }),
      ),
    )
    expect(queue._jobs.size).toBe(1)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('keeps distinct burns on distinct jobs', async () => {
    const { svc, queue } = makeService(sessionRow())
    const hashes = Array.from(
      { length: 25 },
      (_, i) => `0x${i.toString(16).padStart(2, '0').repeat(32)}` as `0x${string}`,
    )
    await Promise.all(
      hashes.map((h) =>
        svc.submitCctpBridge({ sessionId: 'ses_1', sourceChain: 'arbitrum', burnTxHash: h }),
      ),
    )
    expect(queue._jobs.size).toBe(hashes.length)
  })

  it('survives a queue that rejects a duplicate with no recoverable job', async () => {
    // Belt and braces: if `getJob` also comes back empty the error is
    // real infrastructure trouble and must propagate, not be swallowed.
    const { svc, queue } = makeService(sessionRow())
    queue.getJob = async () => null
    await svc.submitCctpBridge({
      sessionId: 'ses_1',
      sourceChain: 'arbitrum',
      burnTxHash: BURN_HASH,
    })
    await expect(
      svc.submitCctpBridge({ sessionId: 'ses_1', sourceChain: 'arbitrum', burnTxHash: BURN_HASH }),
    ).rejects.toThrow(/already exists/i)
  })
})
