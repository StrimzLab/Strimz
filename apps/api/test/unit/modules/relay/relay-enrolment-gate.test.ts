import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { padHex } from 'viem'

import type { RelayChainProbe } from '../../../../src/modules/relay/relay-chain-probe.js'
import { RelayEnrolmentGate } from '../../../../src/modules/relay/relay-enrolment-gate.js'
import type { PermitAndCreateSubscriptionInput } from '../../../../src/modules/relay/relay.types.js'
import type { EnrolmentTermsService } from '../../../../src/modules/subscription-plans/enrolment-terms.service.js'
import type { SubscriptionsService } from '../../../../src/modules/subscriptions/subscriptions.service.js'

const TOKEN = '0x3600000000000000000000000000000000000000'
const OWNER = '0x5555555555555555555555555555555555555555'
const SIG = { v: 27, r: padHex('0xab', { size: 32 }), s: padHex('0xcd', { size: 32 }) }

function enrolment(
  over: Partial<PermitAndCreateSubscriptionInput> = {},
): PermitAndCreateSubscriptionInput {
  return {
    merchantId: 7n,
    token: TOKEN,
    amount: 50_000_000n,
    interval: 3600,
    startAt: 0n,
    endAt: 0n,
    permitData: { owner: OWNER, value: (1n << 256n) - 1n, deadline: 1_800_000_000n },
    permitSignature: SIG,
    intentSignature: SIG,
    merchantInternalId: 'merchant_abc',
    subscriptionInternalId: 'plan_abc',
    ...over,
  }
}

describe('RelayEnrolmentGate', () => {
  let subscriptions: { activeForPayer: ReturnType<typeof vi.fn> }
  let enrolmentTerms: { verify: ReturnType<typeof vi.fn> }
  let probe: { balanceOf: ReturnType<typeof vi.fn> }
  let gate: RelayEnrolmentGate

  beforeEach(() => {
    subscriptions = {
      activeForPayer: vi.fn().mockResolvedValue({ active: false, subscriptionId: null }),
    }
    enrolmentTerms = { verify: vi.fn().mockResolvedValue(undefined) }
    probe = { balanceOf: vi.fn().mockResolvedValue(50_000_000n) }
    gate = new RelayEnrolmentGate(
      subscriptions as unknown as SubscriptionsService,
      enrolmentTerms as unknown as EnrolmentTermsService,
      probe as unknown as RelayChainProbe,
    )
  })

  describe('assertPlanTerms', () => {
    it('verifies the terms against the plan for the resolved merchant', async () => {
      await gate.assertPlanTerms('merchant_abc', enrolment())

      expect(enrolmentTerms.verify).toHaveBeenCalledWith(
        'merchant_abc',
        expect.objectContaining({ planId: 'plan_abc', payer: OWNER, startAt: 0n }),
      )
    })

    it('propagates a terms mismatch', async () => {
      enrolmentTerms.verify.mockRejectedValue(new Error('enrolment_terms_mismatch'))

      await expect(gate.assertPlanTerms('merchant_abc', enrolment())).rejects.toThrow(
        'enrolment_terms_mismatch',
      )
    })

    it('409s when the wallet already subscribes to the plan', async () => {
      subscriptions.activeForPayer.mockResolvedValue({ active: true, subscriptionId: 'sub_1' })

      await expect(gate.assertPlanTerms('merchant_abc', enrolment())).rejects.toMatchObject({
        response: { code: 'subscription_exists', subscriptionId: 'sub_1' },
      })
      expect(enrolmentTerms.verify).not.toHaveBeenCalled()
    })
  })

  describe('assertFunded', () => {
    it('reads the payer balance of the signed token', async () => {
      await gate.assertFunded(enrolment())

      expect(probe.balanceOf).toHaveBeenCalledWith(TOKEN, OWNER)
    })

    it('refuses a payer holding less than the amount', async () => {
      probe.balanceOf.mockResolvedValue(49_999_999n)

      const err = await gate.assertFunded(enrolment()).catch((e: unknown) => e)

      expect(err).toBeInstanceOf(BadRequestException)
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'insufficient_balance',
      })
    })
  })
})
