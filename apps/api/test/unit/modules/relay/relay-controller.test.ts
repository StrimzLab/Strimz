import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { keccak256, padHex, toHex } from 'viem'

import { RelayController } from '../../../../src/modules/relay/relay.controller.js'
import {
  submitPaymentInputSchema,
  submitSubscriptionInputSchema,
} from '../../../../src/modules/relay/relay.dto.js'
import type { RelayService } from '../../../../src/modules/relay/relay.service.js'
import type {
  PayWithAuthorizationInput,
  PermitAndCreateSubscriptionInput,
  RelaySubmissionView,
} from '../../../../src/modules/relay/relay.types.js'
import type { CurrentMerchantPayload } from '../../../../src/common/decorators/current-merchant.decorator.js'

const TOKEN = '0x3600000000000000000000000000000000000000'
const PAYER = '0x4444444444444444444444444444444444444444'
const OWNER = '0x5555555555555555555555555555555555555555'

const VIEW: RelaySubmissionView = {
  id: 'idem-1',
  idempotencyKey: 'idem-1',
  status: 'queued',
  txHash: null,
  reason: 'payWithAuthorization',
  errorReason: null,
  attemptCount: 0,
  enqueuedAt: new Date('2026-01-01T00:00:00Z').toISOString(),
}

function makeRelayMock() {
  return {
    submitPayWithAuthorization: vi.fn<
      (input: PayWithAuthorizationInput) => Promise<RelaySubmissionView>
    >(),
    submitPermitAndCreateSubscription: vi.fn<
      (input: PermitAndCreateSubscriptionInput) => Promise<RelaySubmissionView>
    >(),
    getByIdempotencyKey: vi.fn<(key: string) => Promise<RelaySubmissionView | null>>(),
  }
}

const ctx: CurrentMerchantPayload = {
  merchantId: 'merchant_abc',
  apiKeyId: 'apikey_xyz',
  mode: 'test',
}

function parsedPaymentBody() {
  // We construct the body in its wire shape, then parse via the DTO
  // schema to get the runtime-typed (bigint-bearing) shape the
  // controller actually sees in production.
  return submitPaymentInputSchema.parse({
    idempotencyKey: 'idem-1',
    merchantId: '7',
    token: TOKEN,
    auth: {
      from: PAYER,
      amount: '100000000',
      validAfter: '0',
      validBefore: '1800000000',
      nonce: keccak256(toHex('n1')),
    },
    ref: keccak256(toHex('ref1')),
    signature: { v: 27, r: padHex('0xab', { size: 32 }), s: padHex('0xcd', { size: 32 }) },
    sessionId: 'ses_abc',
  })
}

function parsedSubscriptionBody() {
  return submitSubscriptionInputSchema.parse({
    idempotencyKey: 'idem-sub-1',
    merchantId: '7',
    token: TOKEN,
    amount: '50000000',
    interval: 3600,
    startAt: '0',
    endAt: '0',
    permitData: {
      owner: OWNER,
      value: ((1n << 256n) - 1n).toString(),
      deadline: '1800000000',
    },
    signature: { v: 28, r: padHex('0xde', { size: 32 }), s: padHex('0xef', { size: 32 }) },
    subscriptionInternalId: 'sub_abc',
  })
}

describe('RelayController', () => {
  let relay: ReturnType<typeof makeRelayMock>
  let controller: RelayController

  beforeEach(() => {
    relay = makeRelayMock()
    controller = new RelayController(relay as unknown as RelayService)
  })

  describe('POST /v1/relay/payments', () => {
    it('forwards the parsed body to RelayService.submitPayWithAuthorization', async () => {
      relay.submitPayWithAuthorization.mockResolvedValue(VIEW)
      const body = parsedPaymentBody()
      const result = await controller.submitPayment(ctx, body)
      expect(result).toBe(VIEW)
      expect(relay.submitPayWithAuthorization).toHaveBeenCalledTimes(1)
      const [arg] = relay.submitPayWithAuthorization.mock.calls[0]!
      expect(arg.idempotencyKey).toBe('idem-1')
      expect(arg.merchantId).toBe(7n) // bigint, not string
      expect(arg.auth.amount).toBe(100_000_000n)
      expect(arg.auth.from).toBe(PAYER)
      expect(arg.signature.v).toBe(27)
      expect(arg.sessionId).toBe('ses_abc')
      expect(arg.merchantInternalId).toBe(ctx.merchantId)
    })

    it('rejects malformed addresses at the schema layer', () => {
      expect(() =>
        submitPaymentInputSchema.parse({
          idempotencyKey: 'k',
          merchantId: '1',
          token: '0xnotvalid',
          auth: {
            from: PAYER,
            amount: '1',
            validAfter: '0',
            validBefore: '1',
            nonce: keccak256(toHex('n')),
          },
          ref: keccak256(toHex('r')),
          signature: { v: 27, r: padHex('0x1', { size: 32 }), s: padHex('0x2', { size: 32 }) },
        }),
      ).toThrow(/20-byte address/)
    })

    it('rejects v values outside {27, 28}', () => {
      expect(() =>
        submitPaymentInputSchema.parse({
          idempotencyKey: 'k',
          merchantId: '1',
          token: TOKEN,
          auth: {
            from: PAYER,
            amount: '1',
            validAfter: '0',
            validBefore: '1',
            nonce: keccak256(toHex('n')),
          },
          ref: keccak256(toHex('r')),
          signature: { v: 0, r: padHex('0x1', { size: 32 }), s: padHex('0x2', { size: 32 }) },
        }),
      ).toThrow(/27 or 28/)
    })

    it('rejects idempotency keys with whitespace or control characters', () => {
      expect(() =>
        submitPaymentInputSchema.parse({
          idempotencyKey: 'has spaces',
          merchantId: '1',
          token: TOKEN,
          auth: {
            from: PAYER,
            amount: '1',
            validAfter: '0',
            validBefore: '1',
            nonce: keccak256(toHex('n')),
          },
          ref: keccak256(toHex('r')),
          signature: { v: 27, r: padHex('0x1', { size: 32 }), s: padHex('0x2', { size: 32 }) },
        }),
      ).toThrow(/url-safe ASCII/)
    })

    it('rejects negative or non-numeric amount strings', () => {
      expect(() =>
        submitPaymentInputSchema.parse({
          idempotencyKey: 'k',
          merchantId: '1',
          token: TOKEN,
          auth: {
            from: PAYER,
            amount: '-1', // negative
            validAfter: '0',
            validBefore: '1',
            nonce: keccak256(toHex('n')),
          },
          ref: keccak256(toHex('r')),
          signature: { v: 27, r: padHex('0x1', { size: 32 }), s: padHex('0x2', { size: 32 }) },
        }),
      ).toThrow(/non-negative decimal/)
    })
  })

  describe('POST /v1/relay/subscriptions', () => {
    it('forwards the parsed body to RelayService.submitPermitAndCreateSubscription', async () => {
      const subView: RelaySubmissionView = { ...VIEW, reason: 'permitAndCreateSubscription' }
      relay.submitPermitAndCreateSubscription.mockResolvedValue(subView)
      const body = parsedSubscriptionBody()
      const result = await controller.submitSubscription(ctx, body)
      expect(result).toBe(subView)
      const [arg] = relay.submitPermitAndCreateSubscription.mock.calls[0]!
      expect(arg.idempotencyKey).toBe('idem-sub-1')
      expect(arg.merchantId).toBe(7n)
      expect(arg.amount).toBe(50_000_000n)
      expect(arg.interval).toBe(3600)
      expect(arg.permitData.owner).toBe(OWNER)
      // type(uint256).max preserves through bigint coerce.
      expect(arg.permitData.value).toBe((1n << 256n) - 1n)
      expect(arg.signature.v).toBe(28)
      expect(arg.merchantInternalId).toBe(ctx.merchantId)
    })

    it('rejects non-positive intervals', () => {
      expect(() =>
        submitSubscriptionInputSchema.parse({
          idempotencyKey: 'k',
          merchantId: '1',
          token: TOKEN,
          amount: '1',
          interval: 0, // not positive
          startAt: '0',
          endAt: '0',
          permitData: { owner: OWNER, value: '1', deadline: '1' },
          signature: { v: 27, r: padHex('0x1', { size: 32 }), s: padHex('0x2', { size: 32 }) },
        }),
      ).toThrow()
    })
  })

  describe('GET /v1/relay/submissions/:idempotencyKey', () => {
    it('returns the submission when found', async () => {
      relay.getByIdempotencyKey.mockResolvedValue(VIEW)
      const result = await controller.getSubmission('idem-1')
      expect(result).toBe(VIEW)
      expect(relay.getByIdempotencyKey).toHaveBeenCalledWith('idem-1')
    })

    it('throws NotFoundException when no submission exists', async () => {
      relay.getByIdempotencyKey.mockResolvedValue(null)
      await expect(controller.getSubmission('missing')).rejects.toThrow(NotFoundException)
    })
  })
})
