import { describe, expect, it, vi } from 'vitest'

import { PayerNotificationsService } from '../../src/crons/payer-notifications/payer-notifications.service.js'

function build() {
  const send = vi.fn().mockResolvedValue(undefined)
  const now = new Date('2026-11-21T00:00:00Z')
  const prisma = {
    db: {
      paymentSession: { findMany: vi.fn().mockResolvedValue([]) },
      refund: { findMany: vi.fn().mockResolvedValue([]) },
      subscription: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'sub_started',
            amount: '2000000',
            currency: 'USDC',
            createdAt: now,
            currentPeriodStartAt: now,
            enrolmentTxHash: null,
            merchant: { businessName: 'Fanline' },
            customer: { email: 'payer@example.com' },
            plan: { name: 'Pro', interval: 'monthly', intervalCount: 1 },
          },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
      subscriptionCharge: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'chg_1',
            subscriptionId: 'sub_charged',
            amount: '2000000',
            currency: 'USDC',
            executedAt: now,
            scheduledAt: now,
            onchainTxHash: null,
            merchant: { businessName: 'Fanline' },
            subscription: {
              nextChargeAt: now,
              customer: { email: 'payer@example.com' },
              plan: { name: 'Pro' },
            },
          },
        ]),
        update: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
  const cfg = {
    env: {
      ARC_ENVIRONMENT: 'testnet',
      CHECKOUT_ORIGIN: 'https://checkout.strimz.finance/',
      MERCHANT_NOTIFICATION_BATCH_SIZE: 10,
      SEND_PAYER_CHARGE_RECEIPTS: true,
    },
  }
  const budget = { reserve: vi.fn().mockResolvedValue({ allowed: true }) }
  const svc = new PayerNotificationsService(
    cfg as never,
    prisma as never,
    { send } as never,
    budget as never,
  )
  return { svc, send }
}

describe('payer subscription emails', () => {
  it('link the started and charged emails to the manage page for that subscription', async () => {
    const { svc, send } = build()

    await svc.tickNow()

    const htmls = send.mock.calls.map(([mail]) => (mail as { html: string }).html)
    expect(
      htmls.some((h) =>
        h.includes('https://checkout.strimz.finance/manage?subscription=sub_started'),
      ),
    ).toBe(true)
    expect(
      htmls.some((h) =>
        h.includes('https://checkout.strimz.finance/manage?subscription=sub_charged'),
      ),
    ).toBe(true)
  })
})
