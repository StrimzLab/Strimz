import { BadRequestException, ForbiddenException, type ExecutionContext } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RelayMerchantGuard } from '../../../../src/modules/relay/relay-merchant.guard.js'
import { RelayService } from '../../../../src/modules/relay/relay.service.js'
import type { PrismaService } from '../../../../src/infra/prisma/prisma.service.js'
import type { QueueService } from '../../../../src/infra/queue/queue.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'
import type { RelayAttemptPointers } from '../../../../src/modules/relay/relay-attempts.js'
import type { RelayBudgetService } from '../../../../src/modules/relay/relay-budget.service.js'
import type { RelayChainProbe } from '../../../../src/modules/relay/relay-chain-probe.js'
import type { RelayEnrolmentGate } from '../../../../src/modules/relay/relay-enrolment-gate.js'

function httpContext(body: unknown, merchantId = 'merchant_a'): ExecutionContext {
  const req = { body, merchant: { merchantId, mode: 'test' } }
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext
}

function relayWith(onchainMerchantId: number | null | undefined) {
  const findUnique = vi
    .fn()
    .mockResolvedValue(onchainMerchantId === undefined ? null : { onchainMerchantId })
  const prisma = { db: { merchant: { findUnique } } } as unknown as PrismaService
  const service = new RelayService(
    {} as QueueService,
    prisma,
    { env: {} } as unknown as TypedConfigService,
    {} as RelayChainProbe,
    {} as RelayAttemptPointers,
    {} as RelayEnrolmentGate,
    {} as RelayBudgetService,
  )
  return { service, findUnique }
}

async function refusal(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  return err as { getResponse(): unknown } | null
}

describe('RelayMerchantGuard', () => {
  let guard: RelayMerchantGuard
  let findUnique: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const relay = relayWith(1)
    guard = new RelayMerchantGuard(relay.service)
    findUnique = relay.findUnique
  })

  it('lets the caller relay for its own on-chain merchant id', async () => {
    await expect(guard.canActivate(httpContext({ merchantId: '1' }))).resolves.toBe(true)
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'merchant_a' },
      select: { onchainMerchantId: true },
    })
  })

  it("403s merchant_mismatch for another merchant's on-chain id", async () => {
    const err = await refusal(guard.canActivate(httpContext({ merchantId: '2' })))

    expect(err).toBeInstanceOf(ForbiddenException)
    expect(err?.getResponse()).toMatchObject({ code: 'merchant_mismatch' })
  })

  it('403s merchant_mismatch when the caller has no on-chain id', async () => {
    const relay = relayWith(null)
    const err = await refusal(
      new RelayMerchantGuard(relay.service).canActivate(httpContext({ merchantId: '1' })),
    )

    expect(err).toBeInstanceOf(ForbiddenException)
    expect(err?.getResponse()).toMatchObject({ code: 'merchant_mismatch' })
  })

  it('400s invalid_request on a missing or malformed merchantId without a lookup', async () => {
    for (const body of [{}, { merchantId: 'abc' }, null]) {
      const err = await refusal(guard.canActivate(httpContext(body)))

      expect(err).toBeInstanceOf(BadRequestException)
      expect(err?.getResponse()).toMatchObject({ code: 'invalid_request' })
    }
    expect(findUnique).not.toHaveBeenCalled()
  })
})
