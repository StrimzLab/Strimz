import { beforeEach, describe, expect, it } from 'vitest'
import { decodeFunctionData, encodeAbiParameters, keccak256, padHex, toHex } from 'viem'
import type { RelayJob } from '@strimz/queue-contracts'

import {
  payWithAuthorizationAbi,
  permitAndCreateSubscriptionAbi,
} from '../../../../src/modules/relay/abi.js'
import { RelayService } from '../../../../src/modules/relay/relay.service.js'
import type { RelayAttemptPointers } from '../../../../src/modules/relay/relay-attempts.js'
import type { RelayChainProbe } from '../../../../src/modules/relay/relay-chain-probe.js'
import type { QueueService } from '../../../../src/infra/queue/queue.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'
import type {
  PayWithAuthorizationInput,
  PermitAndCreateSubscriptionInput,
} from '../../../../src/modules/relay/relay.types.js'
import { must } from '../../../helpers/must.js'

type RelayCallJob = Exclude<RelayJob, { reason: 'registerMerchant' }>

interface FakeJob {
  name: string
  data: RelayCallJob
  timestamp: number
  state: 'waiting' | 'active' | 'completed' | 'failed'
  failedReason?: string
}

function makeFakeQueueService() {
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
    add(name: string, data: RelayCallJob, opts: { jobId?: string }) {
      const id = opts.jobId ?? `auto-${jobs.size}`
      if (id.includes(':')) {
        return Promise.reject(new Error('Custom Id cannot contain :'))
      }
      if (jobs.has(id)) {
        return Promise.reject(new Error(`Job ${id} already exists`))
      }
      jobs.set(id, { name, data, timestamp: Date.now(), state: 'waiting' })
      return Promise.resolve(view(id))
    },
    getJob(id: string) {
      return Promise.resolve(jobs.has(id) ? view(id) : null)
    },
    fail(id: string, reason: string) {
      const entry = must(jobs.get(id))
      entry.state = 'failed'
      entry.failedReason = reason
    },
    _jobs: jobs,
  }
  const svc = { queue: () => queue } as unknown as QueueService
  return { svc, queue }
}

const PAYMENTS_ADDR = '0x1111111111111111111111111111111111111111'
const SUBS_ADDR = '0x2222222222222222222222222222222222222222'
const TOKEN_ADDR = '0x3600000000000000000000000000000000000000'
const PAYER = '0x4444444444444444444444444444444444444444'
const OWNER = '0x5555555555555555555555555555555555555555'
const SESSION_ID = 'cmsession0000000000000001'
const PLAN_ID = 'cmplan000000000000000001'
const MERCHANT_INTERNAL_ID = 'merchant_internal_1'
const ONCHAIN_MERCHANT_ID = 7n
const AMOUNT = 100_000_000n

function sessionPaymentNonce(sessionId: string): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'string' }],
      ['strimz.checkout.payment-nonce.v1', sessionId],
    ),
  )
}

function makeCfg(): TypedConfigService {
  return {
    env: {
      STRIMZ_PAYMENTS_ADDRESS: PAYMENTS_ADDR,
      STRIMZ_SUBSCRIPTIONS_ADDRESS: SUBS_ADDR,
    },
  } as unknown as TypedConfigService
}

function makePrisma(sessionStatus: { current: string }): PrismaService {
  return {
    db: {
      paymentSession: {
        findUnique: () =>
          Promise.resolve({
            status: sessionStatus.current,
            amount: AMOUNT.toString(),
            expiresAt: null,
            onchainTxHash: null,
            updatedAt: new Date('2026-10-03T00:00:00Z'),
            merchant: { onchainMerchantId: Number(ONCHAIN_MERCHANT_ID) },
          }),
      },
      subscription: { findFirst: () => Promise.resolve(null) },
    },
  } as unknown as PrismaService
}

function sig(tag: string) {
  return {
    v: 27,
    r: keccak256(toHex(`r-${tag}`)),
    s: padHex(toHex(`s-${tag}`), { size: 32 }),
  }
}

function payAttempt(
  tag: string,
  over: Partial<PayWithAuthorizationInput> = {},
): PayWithAuthorizationInput {
  return {
    idempotencyKey: SESSION_ID,
    merchantId: ONCHAIN_MERCHANT_ID,
    token: TOKEN_ADDR,
    auth: {
      from: PAYER,
      amount: AMOUNT,
      validAfter: 0n,
      validBefore: 1_900_000_000n + BigInt(tag.length),
      nonce: sessionPaymentNonce(SESSION_ID),
    },
    ref: padHex(toHex(SESSION_ID), { dir: 'right', size: 32 }),
    authSignature: sig(`auth-${tag}`),
    intentSignature: sig(`intent-${tag}`),
    merchantInternalId: MERCHANT_INTERNAL_ID,
    sessionId: SESSION_ID,
    ...over,
  }
}

function subscriptionAttempt(tag: string): PermitAndCreateSubscriptionInput {
  return {
    idempotencyKey: `${PLAN_ID}-${OWNER.toLowerCase()}`,
    merchantId: ONCHAIN_MERCHANT_ID,
    token: TOKEN_ADDR,
    amount: 50_000_000n,
    interval: 2_592_000,
    startAt: 0n,
    endAt: 0n,
    permitData: {
      owner: OWNER,
      value: (1n << 256n) - 1n,
      deadline: 1_900_000_000n + BigInt(tag.length),
    },
    permitSignature: sig(`permit-${tag}`),
    intentSignature: sig(`sub-intent-${tag}`),
    merchantInternalId: MERCHANT_INTERNAL_ID,
    subscriptionInternalId: PLAN_ID,
  }
}

const FORGED_SIGNATURES = new Set<string>([sig('auth-junk').r, sig('permit-junk').r])

function makeProbe(): RelayChainProbe {
  return {
    simulate: ({ data }: { data: `0x${string}` }) => {
      const forged = [...FORGED_SIGNATURES].some((r) => data.includes(r.slice(2)))
      return forged
        ? Promise.reject(new Error('simulation reverted: invalid signature'))
        : Promise.resolve()
    },
    receiptStatus: () => Promise.resolve(null),
    latestBlockTimestamp: () => Promise.resolve(1_800_000_000n),
  } as unknown as RelayChainProbe
}

function makePointers(): RelayAttemptPointers {
  const pointers = new Map<string, string>()
  return {
    current: (scope: string) => Promise.resolve(pointers.get(scope) ?? null),
    claim: (scope: string, expected: string | null, next: string) => {
      if ((pointers.get(scope) ?? null) !== expected) return Promise.resolve(false)
      pointers.set(scope, next)
      return Promise.resolve(true)
    },
  } as unknown as RelayAttemptPointers
}

function payAuthSignatureOf(job: FakeJob): string {
  const decoded = decodeFunctionData({ abi: payWithAuthorizationAbi, data: job.data.callData })
  return (decoded.args[4] as { r: string }).r
}

function permitSignatureOf(job: FakeJob): string {
  const decoded = decodeFunctionData({
    abi: permitAndCreateSubscriptionAbi,
    data: job.data.callData,
  })
  return (decoded.args[7] as { r: string }).r
}

describe('RelayService checkout idempotency', () => {
  let queue: ReturnType<typeof makeFakeQueueService>['queue']
  let sessionStatus: { current: string }
  let service: RelayService

  beforeEach(() => {
    const { svc, queue: q } = makeFakeQueueService()
    queue = q
    sessionStatus = { current: 'awaiting_payment' }
    service = new RelayService(
      svc,
      makePrisma(sessionStatus),
      makeCfg(),
      makeProbe(),
      makePointers(),
    )
  })

  describe('payments', () => {
    it('does not let a submission carrying the session id as its key block the payer', async () => {
      await Promise.allSettled([service.submitPayWithAuthorization(payAttempt('junk'))])
      const real = payAttempt('payer')

      const view = await service.submitPayWithAuthorization(real)

      const job = must(queue._jobs.get(view.idempotencyKey))
      expect(payAuthSignatureOf(job)).toBe(real.authSignature.r)
      expect(view.status).toBe('queued')
    })

    it('issues a key that is not the client-supplied key and is a valid BullMQ job id', async () => {
      const view = await service.submitPayWithAuthorization(payAttempt('payer'))

      expect(view.idempotencyKey).not.toBe(SESSION_ID)
      expect(view.idempotencyKey).not.toContain(SESSION_ID)
      expect(view.idempotencyKey).not.toContain(':')
      expect(queue._jobs.has(view.idempotencyKey)).toBe(true)
    })

    it('enqueues a new attempt after the previous attempt for the session failed', async () => {
      const first = await service.submitPayWithAuthorization(payAttempt('first'))
      queue.fail(first.idempotencyKey, 'tx reverted')

      const retry = payAttempt('second-attempt')
      const second = await service.submitPayWithAuthorization(retry)

      expect(second.status).toBe('queued')
      expect(second.errorReason).toBeNull()
      expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
      expect(queue._jobs.size).toBe(2)
      expect(payAuthSignatureOf(must(queue._jobs.get(second.idempotencyKey)))).toBe(
        retry.authSignature.r,
      )
    })

    it('returns the same submission for a resubmission of the identical signed payload', async () => {
      const attempt = payAttempt('payer')
      const a = await service.submitPayWithAuthorization(attempt)
      const b = await service.submitPayWithAuthorization(attempt)

      expect(b.id).toBe(a.id)
      expect(queue._jobs.size).toBe(1)
    })

    it('rejects an authorization whose EIP-3009 nonce is not the session payment nonce', async () => {
      const foreignNonce = payAttempt('payer', {
        auth: {
          from: PAYER,
          amount: AMOUNT,
          validAfter: 0n,
          validBefore: 1_900_000_000n,
          nonce: keccak256(toHex('browser-random-nonce')),
        },
      })

      await expect(service.submitPayWithAuthorization(foreignNonce)).rejects.toThrow()
      expect(queue._jobs.size).toBe(0)
    })

    it('enqueues nothing for a session whose payment was already mined', async () => {
      sessionStatus.current = 'submitted'

      await Promise.allSettled([service.submitPayWithAuthorization(payAttempt('other-wallet'))])

      expect(queue._jobs.size).toBe(0)
    })
  })

  describe('subscriptions', () => {
    it('does not let a submission carrying the plan-payer key block the payer', async () => {
      await Promise.allSettled([
        service.submitPermitAndCreateSubscription(subscriptionAttempt('junk')),
      ])
      const real = subscriptionAttempt('payer')

      const view = await service.submitPermitAndCreateSubscription(real)

      const job = must(queue._jobs.get(view.idempotencyKey))
      expect(permitSignatureOf(job)).toBe(real.permitSignature.r)
    })

    it('enqueues a new attempt after the previous enrolment attempt failed', async () => {
      const first = await service.submitPermitAndCreateSubscription(subscriptionAttempt('first'))
      queue.fail(first.idempotencyKey, 'tx reverted')

      const second = await service.submitPermitAndCreateSubscription(
        subscriptionAttempt('second-attempt'),
      )

      expect(second.status).toBe('queued')
      expect(second.idempotencyKey).not.toBe(first.idempotencyKey)
      expect(queue._jobs.size).toBe(2)
    })
  })

  describe('getByIdempotencyKey', () => {
    it('returns the submission only to the merchant and session it belongs to', async () => {
      const view = await service.submitPayWithAuthorization(payAttempt('payer'))

      const own = await service.getByIdempotencyKey(view.idempotencyKey, {
        merchantInternalId: MERCHANT_INTERNAL_ID,
        sessionId: SESSION_ID,
      })
      const otherSession = await service.getByIdempotencyKey(view.idempotencyKey, {
        merchantInternalId: MERCHANT_INTERNAL_ID,
        sessionId: 'cmsession0000000000000002',
      })
      const otherMerchant = await service.getByIdempotencyKey(view.idempotencyKey, {
        merchantInternalId: 'merchant_internal_2',
      })

      expect(must(own).idempotencyKey).toBe(view.idempotencyKey)
      expect(otherSession).toBeNull()
      expect(otherMerchant).toBeNull()
    })
  })
})
