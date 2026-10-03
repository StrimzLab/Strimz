import { beforeEach, describe, expect, it } from 'vitest'
import { keccak256, padHex, stringToHex, toHex, type Hex } from 'viem'
import type { RelayJob } from '@strimz/queue-contracts'
import { checkoutPaymentNonce } from '@strimz/shared-crypto/checkout'

import { RelayService } from '../../../../src/modules/relay/relay.service.js'
import {
  paymentAttemptScope,
  subscriptionAttemptScope,
  type RelayAttemptPointers,
} from '../../../../src/modules/relay/relay-attempts.js'
import type {
  RelayChainProbe,
  RelayReceiptStatus,
} from '../../../../src/modules/relay/relay-chain-probe.js'
import type { QueueService } from '../../../../src/infra/queue/queue.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'
import type {
  PayWithAuthorizationInput,
  PermitAndCreateSubscriptionInput,
} from '../../../../src/modules/relay/relay.types.js'
import { must } from '../../../helpers/must.js'

type RelayCallJob = Exclude<RelayJob, { reason: 'registerMerchant' }>
type JobState = 'waiting' | 'active' | 'completed' | 'failed'

interface FakeJob {
  data: RelayCallJob
  timestamp: number
  state: JobState
  failedReason?: string
}

const PAYMENTS_ADDR = '0x1111111111111111111111111111111111111111'
const SUBS_ADDR = '0x2222222222222222222222222222222222222222'
const TOKEN_ADDR = '0x3600000000000000000000000000000000000000'
const PAYER = '0x4444444444444444444444444444444444444444'
const OWNER = '0x5555555555555555555555555555555555555555'
const SESSION_ID = 'cmsession0000000000000009'
const PLAN_ID = 'cmplan000000000000000009'
const MERCHANT_INTERNAL_ID = 'merchant_internal_9'
const AMOUNT = 25_000_000n
const CHAIN_NOW = 1_800_000_000n
const PENDING_TX = keccak256(toHex('pending-tx'))

function makeQueue() {
  const jobs = new Map<string, FakeJob>()
  const view = (id: string) => {
    const entry = must(jobs.get(id))
    return {
      id,
      data: entry.data,
      timestamp: entry.timestamp,
      attemptsMade: entry.state === 'failed' ? 5 : 0,
      failedReason: entry.failedReason,
      returnvalue: undefined,
      getState: () => Promise.resolve(entry.state),
    }
  }
  const queue = {
    add(_name: string, data: RelayCallJob, opts: { jobId: string }) {
      if (jobs.has(opts.jobId)) return Promise.reject(new Error(`Job ${opts.jobId} exists`))
      jobs.set(opts.jobId, { data, timestamp: Date.now(), state: 'waiting' })
      return Promise.resolve(view(opts.jobId))
    },
    getJob(id: string) {
      return Promise.resolve(jobs.has(id) ? view(id) : null)
    },
    settle(id: string, state: JobState, broadcastTx?: Hex) {
      const entry = must(jobs.get(id))
      entry.state = state
      if (state === 'failed') entry.failedReason = 'receipt timeout'
      if (broadcastTx)
        entry.data = { ...entry.data, broadcast: { txHash: broadcastTx, nonce: '7' } }
    },
    drop(id: string) {
      jobs.delete(id)
    },
    jobs,
  }
  return { svc: { queue: () => queue } as unknown as QueueService, queue }
}

function makeProbe() {
  const state = {
    receipts: new Map<Hex, RelayReceiptStatus>(),
    revert: null as string | null,
    simulated: 0,
  }
  const probe = {
    simulate: () => {
      state.simulated += 1
      return state.revert ? Promise.reject(new Error(state.revert)) : Promise.resolve()
    },
    receiptStatus: (hash: Hex) => Promise.resolve(state.receipts.get(hash) ?? null),
    latestBlockTimestamp: () => Promise.resolve(CHAIN_NOW),
  } as unknown as RelayChainProbe
  return { probe, state }
}

function makePointers() {
  const map = new Map<string, string>()
  const state = { refuseClaim: false }
  const pointers = {
    current: (scope: string) => Promise.resolve(map.get(scope) ?? null),
    claim: (scope: string, expected: string | null, next: string) => {
      if (state.refuseClaim || (map.get(scope) ?? null) !== expected) {
        return Promise.resolve(false)
      }
      map.set(scope, next)
      return Promise.resolve(true)
    },
  } as unknown as RelayAttemptPointers
  return { pointers, map, state }
}

function makePrisma(status: { current: string }): PrismaService {
  return {
    db: {
      paymentSession: {
        findUnique: () =>
          Promise.resolve({
            status: status.current,
            amount: AMOUNT.toString(),
            expiresAt: null,
            onchainTxHash: null,
            updatedAt: new Date('2026-10-03T00:00:00Z'),
            merchant: { onchainMerchantId: 3 },
          }),
      },
      subscription: { findFirst: () => Promise.resolve(null) },
    },
  } as unknown as PrismaService
}

function makeCfg(): TypedConfigService {
  return {
    env: { STRIMZ_PAYMENTS_ADDRESS: PAYMENTS_ADDR, STRIMZ_SUBSCRIPTIONS_ADDRESS: SUBS_ADDR },
  } as unknown as TypedConfigService
}

function sig(tag: string) {
  return { v: 27, r: keccak256(toHex(`r-${tag}`)), s: padHex(toHex(`s-${tag}`), { size: 32 }) }
}

function payment(tag: string, validBefore: bigint): PayWithAuthorizationInput {
  return {
    merchantId: 3n,
    token: TOKEN_ADDR,
    auth: {
      from: PAYER,
      amount: AMOUNT,
      validAfter: 0n,
      validBefore,
      nonce: checkoutPaymentNonce(SESSION_ID),
    },
    ref: stringToHex(SESSION_ID, { size: 32 }),
    authSignature: sig(`auth-${tag}`),
    intentSignature: sig(`intent-${tag}`),
    merchantInternalId: MERCHANT_INTERNAL_ID,
    sessionId: SESSION_ID,
  }
}

function enrolment(tag: string): PermitAndCreateSubscriptionInput {
  return {
    merchantId: 3n,
    token: TOKEN_ADDR,
    amount: 10_000_000n,
    interval: 86_400,
    startAt: 0n,
    endAt: 0n,
    permitData: { owner: OWNER, value: (1n << 256n) - 1n, deadline: CHAIN_NOW + 86_400n },
    permitSignature: sig(`permit-${tag}`),
    intentSignature: sig(`sub-intent-${tag}`),
    merchantInternalId: MERCHANT_INTERNAL_ID,
    subscriptionInternalId: PLAN_ID,
  }
}

describe('RelayService live-attempt pointer', () => {
  let queue: ReturnType<typeof makeQueue>['queue']
  let probe: ReturnType<typeof makeProbe>
  let pointers: ReturnType<typeof makePointers>
  let sessionStatus: { current: string }
  let service: RelayService

  beforeEach(() => {
    const q = makeQueue()
    queue = q.queue
    probe = makeProbe()
    pointers = makePointers()
    sessionStatus = { current: 'awaiting_payment' }
    service = new RelayService(
      q.svc,
      makePrisma(sessionStatus),
      makeCfg(),
      probe.probe,
      pointers.pointers,
    )
  })

  describe('payments', () => {
    it('points the session at the enqueued job', async () => {
      const view = await service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n))

      expect(pointers.map.get(paymentAttemptScope(SESSION_ID))).toBe(view.idempotencyKey)
    })

    it('refuses a new attempt while the previous job is still live and returns its view', async () => {
      const first = await service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n))

      await expect(
        service.submitPayWithAuthorization(payment('second', CHAIN_NOW + 301n)),
      ).rejects.toMatchObject({
        status: 409,
        response: {
          code: 'attempt_in_progress',
          details: { submission: { idempotencyKey: first.idempotencyKey, status: 'queued' } },
        },
      })
      expect(queue.jobs.size).toBe(1)
    })

    it('refuses while a failed job has a pending tx inside its authorization window', async () => {
      const first = await service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n))
      queue.settle(first.idempotencyKey, 'failed', PENDING_TX)

      await expect(
        service.submitPayWithAuthorization(payment('second', CHAIN_NOW + 301n)),
      ).rejects.toMatchObject({ status: 409, response: { code: 'attempt_in_progress' } })
      expect(queue.jobs.size).toBe(1)
      expect(pointers.map.get(paymentAttemptScope(SESSION_ID))).toBe(first.idempotencyKey)
    })

    it('accepts a new attempt once the pending tx authorization window has passed', async () => {
      const first = await service.submitPayWithAuthorization(payment('first', CHAIN_NOW))
      queue.settle(first.idempotencyKey, 'failed', PENDING_TX)

      const second = await service.submitPayWithAuthorization(payment('second', CHAIN_NOW + 300n))

      expect(second.status).toBe('queued')
      expect(pointers.map.get(paymentAttemptScope(SESSION_ID))).toBe(second.idempotencyKey)
    })

    it('refuses with already_settled when the previous tx has a successful receipt', async () => {
      const first = await service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n))
      queue.settle(first.idempotencyKey, 'failed', PENDING_TX)
      probe.state.receipts.set(PENDING_TX, 'success')

      await expect(
        service.submitPayWithAuthorization(payment('second', CHAIN_NOW + 301n)),
      ).rejects.toMatchObject({ status: 409, response: { code: 'already_settled' } })
      expect(queue.jobs.size).toBe(1)
    })

    it('refuses with already_settled when the previous job completed', async () => {
      const first = await service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n))
      queue.settle(first.idempotencyKey, 'completed')

      await expect(
        service.submitPayWithAuthorization(payment('second', CHAIN_NOW + 301n)),
      ).rejects.toMatchObject({ status: 409, response: { code: 'already_settled' } })
    })

    it('accepts a new attempt when the previous tx reverted', async () => {
      const first = await service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n))
      queue.settle(first.idempotencyKey, 'failed', PENDING_TX)
      probe.state.receipts.set(PENDING_TX, 'reverted')

      const second = await service.submitPayWithAuthorization(payment('second', CHAIN_NOW + 301n))

      expect(second.status).toBe('queued')
      expect(queue.jobs.size).toBe(2)
    })

    it('accepts a new attempt when the pointed-at job aged out of the queue', async () => {
      const first = await service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n))
      queue.drop(first.idempotencyKey)

      const second = await service.submitPayWithAuthorization(payment('second', CHAIN_NOW + 301n))

      expect(second.status).toBe('queued')
      expect(pointers.map.get(paymentAttemptScope(SESSION_ID))).toBe(second.idempotencyKey)
    })

    it('refuses when another attempt wins the pointer first', async () => {
      pointers.state.refuseClaim = true

      await expect(
        service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n)),
      ).rejects.toMatchObject({ status: 409, response: { code: 'attempt_in_progress' } })
      expect(queue.jobs.size).toBe(0)
    })

    it('refuses a reverting simulation before touching the pointer or the queue', async () => {
      probe.state.revert = 'relay_simulation_failed'

      await expect(
        service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n)),
      ).rejects.toThrow('relay_simulation_failed')
      expect(queue.jobs.size).toBe(0)
      expect(pointers.map.size).toBe(0)
    })

    it('refuses a foreign nonce with auth_nonce_mismatch before simulating', async () => {
      const input = payment('first', CHAIN_NOW + 300n)
      input.auth.nonce = keccak256(toHex('random'))

      await expect(service.submitPayWithAuthorization(input)).rejects.toMatchObject({
        status: 400,
        response: { code: 'auth_nonce_mismatch' },
      })
      expect(probe.state.simulated).toBe(0)
    })

    it('refuses a submitted session with session_already_submitted', async () => {
      sessionStatus.current = 'submitted'

      await expect(
        service.submitPayWithAuthorization(payment('first', CHAIN_NOW + 300n)),
      ).rejects.toMatchObject({ status: 409, response: { code: 'session_already_submitted' } })
    })
  })

  describe('subscriptions', () => {
    it('accepts a new enrolment while the previous failed job has a pending tx', async () => {
      const first = await service.submitPermitAndCreateSubscription(enrolment('first'))
      queue.settle(first.idempotencyKey, 'failed', PENDING_TX)

      const second = await service.submitPermitAndCreateSubscription(enrolment('second'))

      expect(second.status).toBe('queued')
      expect(pointers.map.get(subscriptionAttemptScope(PLAN_ID, OWNER))).toBe(second.idempotencyKey)
    })

    it('refuses with already_settled when the previous enrolment tx succeeded', async () => {
      const first = await service.submitPermitAndCreateSubscription(enrolment('first'))
      queue.settle(first.idempotencyKey, 'failed', PENDING_TX)
      probe.state.receipts.set(PENDING_TX, 'success')

      await expect(
        service.submitPermitAndCreateSubscription(enrolment('second')),
      ).rejects.toMatchObject({ status: 409, response: { code: 'already_settled' } })
    })

    it('keeps one pointer per payer on a shared plan', async () => {
      await service.submitPermitAndCreateSubscription(enrolment('first'))
      const other = enrolment('other-wallet')
      other.permitData.owner = '0x6666666666666666666666666666666666666666'

      const view = await service.submitPermitAndCreateSubscription(other)

      expect(view.status).toBe('queued')
      expect(pointers.map.size).toBe(2)
    })
  })
})
