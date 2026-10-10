import { beforeEach, describe, expect, it } from 'vitest'
import { decodeFunctionData, keccak256, padHex, toHex } from 'viem'

import {
  payWithAuthorizationAbi,
  permitAndCreateSubscriptionAbi,
} from '../../../../src/modules/relay/abi.js'
import { RelayService } from '../../../../src/modules/relay/relay.service.js'
import type { RelayAttemptPointers } from '../../../../src/modules/relay/relay-attempts.js'
import type { RelayChainProbe } from '../../../../src/modules/relay/relay-chain-probe.js'
import type { RelayBudgetService } from '../../../../src/modules/relay/relay-budget.service.js'
import type { RelayEnrolmentGate } from '../../../../src/modules/relay/relay-enrolment-gate.js'
import type { QueueService } from '../../../../src/infra/queue/queue.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'
import type { RelayJob } from '@strimz/queue-contracts'
import { checkoutPaymentNonce } from '@strimz/shared-crypto/checkout'
import type {
  PayWithAuthorizationInput,
  PermitAndCreateSubscriptionInput,
} from '../../../../src/modules/relay/relay.types.js'
import { must } from '../../../helpers/must.js'

type RelayCallJob = Exclude<RelayJob, { reason: 'registerMerchant' }>

/**
 * Fake BullMQ queue. Records every `add()` call so tests can inspect
 * what calldata the service produced. `getJob` returns a frozen view.
 */
function makeFakeQueueService() {
  const jobs = new Map<string, { name: string; data: RelayCallJob; timestamp: number }>()
  const queue = {
    add(name: string, data: RelayCallJob, opts: { jobId?: string }) {
      const id = opts.jobId ?? `auto-${jobs.size}`
      if (jobs.has(id)) {
        // Mirror BullMQ's documented behaviour: duplicate ids reject.
        const err: Error & { code?: string } = new Error(`Job ${id} already exists`)
        err.code = 'DUPLICATE_JOB'
        return Promise.reject(err)
      }
      jobs.set(id, { name, data, timestamp: Date.now() })
      return Promise.resolve(makeJobView(id, jobs))
    },
    getJob(id: string) {
      return Promise.resolve(jobs.has(id) ? makeJobView(id, jobs) : null)
    },
    _jobs: jobs,
  }
  const svc = {
    queue: () => queue,
  } as unknown as QueueService
  return { svc, queue }
}

function makeJobView(
  id: string,
  jobs: Map<string, { name: string; data: RelayCallJob; timestamp: number }>,
) {
  const entry = must(jobs.get(id))
  return {
    id,
    data: entry.data,
    timestamp: entry.timestamp,
    attemptsMade: 0,
    failedReason: undefined,
    returnvalue: undefined,
    getState() {
      return Promise.resolve('waiting')
    },
  }
}

const PAYMENTS_ADDR = '0x1111111111111111111111111111111111111111'
const SUBS_ADDR = '0x2222222222222222222222222222222222222222'
const TOKEN_ADDR = '0x3600000000000000000000000000000000000000'

function makeCfg(): TypedConfigService {
  return {
    env: {
      STRIMZ_PAYMENTS_ADDRESS: PAYMENTS_ADDR,
      STRIMZ_SUBSCRIPTIONS_ADDRESS: SUBS_ADDR,
      ARC_USDC_ADDRESS: TOKEN_ADDR,
    },
  } as unknown as TypedConfigService
}

/**
 * Fake Prisma. `RelayService` calls `paymentSession.findUnique` and
 * `subscription.findFirst` to short-circuit on already-confirmed
 * sessions / already-enrolled subscriptions; returning `null` keeps
 * every test exercising the fresh-submission path.
 */
function makeFakePrisma(): PrismaService {
  return {
    db: {
      paymentSession: {
        findUnique: () =>
          Promise.resolve({
            status: 'awaiting_payment',
            amount: '100000000',
            currency: 'USDC',
            expiresAt: null,
            merchant: { onchainMerchantId: 1 },
          }),
      },
      subscription: { findFirst: () => Promise.resolve(null) },
    },
  } as unknown as PrismaService
}

function makeFakeProbe(): RelayChainProbe {
  return {
    simulate: () => Promise.resolve(),
    receiptStatus: () => Promise.resolve(null),
    latestBlockTimestamp: () => Promise.resolve(1_700_000_000n),
  } as unknown as RelayChainProbe
}

function makeFakePointers(): RelayAttemptPointers {
  return {
    current: () => Promise.resolve(null),
    claim: () => Promise.resolve(true),
  } as unknown as RelayAttemptPointers
}

function makeEnrolmentGate(): RelayEnrolmentGate {
  return {
    assertPlanTerms: () => Promise.resolve(),
    assertFunded: () => Promise.resolve(),
  } as unknown as RelayEnrolmentGate
}

function makeBudget(): RelayBudgetService {
  return { consume: () => Promise.resolve() } as unknown as RelayBudgetService
}

const MERCHANT_INTERNAL_ID = 'merchant_1'
const SESSION_ID = 'ses_1'

function payInput(over: Partial<PayWithAuthorizationInput> = {}): PayWithAuthorizationInput {
  return {
    idempotencyKey: 'idem-1',
    merchantId: 1n,
    token: TOKEN_ADDR,
    auth: {
      from: '0x4444444444444444444444444444444444444444',
      amount: 100_000_000n,
      validAfter: 0n,
      validBefore: 1_800_000_000n,
      nonce: checkoutPaymentNonce(SESSION_ID),
    },
    ref: keccak256(toHex('session-1')),
    authSignature: { v: 27, r: padHex('0xab', { size: 32 }), s: padHex('0xcd', { size: 32 }) },
    intentSignature: { v: 27, r: padHex('0x1a', { size: 32 }), s: padHex('0x1b', { size: 32 }) },
    merchantInternalId: MERCHANT_INTERNAL_ID,
    sessionId: SESSION_ID,
    ...over,
  }
}

function subsInput(
  over: Partial<PermitAndCreateSubscriptionInput> = {},
): PermitAndCreateSubscriptionInput {
  return {
    idempotencyKey: 'idem-sub-1',
    merchantId: 1n,
    token: TOKEN_ADDR,
    amount: 50_000_000n,
    interval: 3600,
    startAt: 0n,
    endAt: 0n,
    permitData: {
      owner: '0x5555555555555555555555555555555555555555',
      value: (1n << 256n) - 1n,
      deadline: 1_800_000_000n,
    },
    permitSignature: { v: 28, r: padHex('0xde', { size: 32 }), s: padHex('0xef', { size: 32 }) },
    intentSignature: { v: 28, r: padHex('0x2a', { size: 32 }), s: padHex('0x2b', { size: 32 }) },
    merchantInternalId: MERCHANT_INTERNAL_ID,
    subscriptionInternalId: 'plan_1',
    ...over,
  }
}

describe('RelayService', () => {
  let queue: ReturnType<typeof makeFakeQueueService>['queue']
  let service: RelayService

  beforeEach(() => {
    const { svc, queue: q } = makeFakeQueueService()
    queue = q
    service = new RelayService(
      svc,
      makeFakePrisma(),
      makeCfg(),
      makeFakeProbe(),
      makeFakePointers(),
      makeEnrolmentGate(),
      makeBudget(),
    )
  })

  describe('submitPayWithAuthorization', () => {
    it('encodes calldata matching payWithAuthorization ABI and enqueues to Payments', async () => {
      const input = payInput()
      const view = await service.submitPayWithAuthorization(input)
      expect(view.status).toBe('queued')
      expect(view.reason).toBe('payWithAuthorization')
      expect(view.idempotencyKey).toMatch(/^relay-pay-[0-9a-f]{64}$/u)
      expect(view.idempotencyKey).not.toBe(input.idempotencyKey)

      const job = must(queue._jobs.get(view.idempotencyKey))
      expect(job.data.idempotencyKey).toBe(view.idempotencyKey)
      expect(job.data.toAddress.toLowerCase()).toBe(PAYMENTS_ADDR.toLowerCase())

      const decoded = decodeFunctionData({
        abi: payWithAuthorizationAbi,
        data: job.data.callData,
      })
      expect(decoded.functionName).toBe('payWithAuthorization')
      expect(decoded.args[0]).toBe(input.merchantId)
      expect((decoded.args[1] as string).toLowerCase()).toBe(input.token.toLowerCase())
      const authArg = decoded.args[2] as {
        from: string
        amount: bigint
        validAfter: bigint
        validBefore: bigint
        nonce: string
      }
      expect(authArg.from.toLowerCase()).toBe(input.auth.from.toLowerCase())
      expect(authArg.amount).toBe(input.auth.amount)
      expect(authArg.nonce).toBe(input.auth.nonce)
      expect(decoded.args[3]).toBe(input.ref)
      const authSig = decoded.args[4] as { v: number; r: string; s: string }
      expect(authSig.v).toBe(input.authSignature.v)
      expect(authSig.r).toBe(input.authSignature.r)
      expect(authSig.s).toBe(input.authSignature.s)
      const intentSig = decoded.args[5] as { v: number; r: string; s: string }
      expect(intentSig.v).toBe(input.intentSignature.v)
      expect(intentSig.r).toBe(input.intentSignature.r)
      expect(intentSig.s).toBe(input.intentSignature.s)
    })

    it('is idempotent on the signed payload', async () => {
      const input = payInput({ idempotencyKey: 'idem-dup' })
      const a = await service.submitPayWithAuthorization(input)
      const b = await service.submitPayWithAuthorization(input)
      expect(b.id).toBe(a.id)
      expect(queue._jobs.size).toBe(1)
    })

    it('uses the configured payments address as the target', async () => {
      const view = await service.submitPayWithAuthorization(payInput())
      const job = must(queue._jobs.get(view.idempotencyKey))
      expect(job.data.toAddress).toBe(PAYMENTS_ADDR)
    })

    it('throws when STRIMZ_PAYMENTS_ADDRESS is unset', async () => {
      const { svc } = makeFakeQueueService()
      const cfgEmpty = {
        env: { STRIMZ_PAYMENTS_ADDRESS: undefined },
      } as unknown as TypedConfigService
      const svcNoAddr = new RelayService(
        svc,
        makeFakePrisma(),
        cfgEmpty,
        makeFakeProbe(),
        makeFakePointers(),
        makeEnrolmentGate(),
        makeBudget(),
      )
      await expect(svcNoAddr.submitPayWithAuthorization(payInput())).rejects.toThrow(
        /STRIMZ_PAYMENTS_ADDRESS/,
      )
    })
  })

  describe('submitPermitAndCreateSubscription', () => {
    it('encodes calldata matching the ABI and enqueues to Subscriptions', async () => {
      const input = subsInput()
      const view = await service.submitPermitAndCreateSubscription(input)
      expect(view.reason).toBe('permitAndCreateSubscription')
      expect(view.idempotencyKey).toMatch(/^relay-sub-[0-9a-f]{64}$/u)
      const job = must(queue._jobs.get(view.idempotencyKey))
      expect(job.data.toAddress).toBe(SUBS_ADDR)

      const decoded = decodeFunctionData({
        abi: permitAndCreateSubscriptionAbi,
        data: job.data.callData,
      })
      expect(decoded.functionName).toBe('permitAndCreateSubscription')
      expect(decoded.args[0]).toBe(input.merchantId)
      expect((decoded.args[1] as string).toLowerCase()).toBe(input.token.toLowerCase())
      expect(decoded.args[2]).toBe(input.amount)
      expect(decoded.args[3]).toBe(input.interval)
      expect(decoded.args[4]).toBe(input.startAt)
      expect(decoded.args[5]).toBe(input.endAt)
      const permitArg = decoded.args[6] as { owner: string; value: bigint; deadline: bigint }
      expect(permitArg.owner.toLowerCase()).toBe(input.permitData.owner.toLowerCase())
      expect(permitArg.value).toBe(input.permitData.value)
      expect(permitArg.deadline).toBe(input.permitData.deadline)
    })
  })

  describe('getByIdempotencyKey', () => {
    it('returns null for an unknown key', async () => {
      const view = await service.getByIdempotencyKey('does-not-exist', {
        merchantInternalId: MERCHANT_INTERNAL_ID,
      })
      expect(view).toBeNull()
    })

    it('returns the same view shape produced by enqueue', async () => {
      const input = payInput({ idempotencyKey: 'idem-lookup' })
      const enqueued = await service.submitPayWithAuthorization(input)
      const looked = await service.getByIdempotencyKey(enqueued.idempotencyKey, {
        merchantInternalId: MERCHANT_INTERNAL_ID,
      })
      expect(looked).not.toBeNull()
      expect(must(looked).idempotencyKey).toBe(enqueued.idempotencyKey)
      expect(must(looked).reason).toBe(enqueued.reason)
    })
  })
})
