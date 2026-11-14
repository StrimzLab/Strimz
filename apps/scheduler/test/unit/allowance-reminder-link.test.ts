import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Subscription } from '@strimz/db'

import { AllowanceReminderService } from '../../src/workers/subscription-due/allowance-reminder.service.js'

const sub = {
  id: 'sub_1',
  currency: 'USDC',
  amount: '1000000',
  payerAddress: '0x00000000000000000000000000000000000000aa',
  currentPeriodEndAt: new Date('2026-12-01T00:00:00Z'),
  metadata: {},
} as unknown as Subscription

function build() {
  const send = vi.fn().mockResolvedValue(undefined)
  const prisma = {
    db: {
      subscription: {
        findMany: vi.fn().mockResolvedValue([{ amount: '1000000' }]),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          customer: { email: 'payer@example.com' },
          plan: { name: 'Pro' },
          merchant: { businessName: 'Fanline' },
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
  const chain = { readSubscriptionAllowance: vi.fn().mockResolvedValue(0n) }
  const cfg = {
    env: { ARC_ENVIRONMENT: 'testnet', CHECKOUT_ORIGIN: 'https://checkout.strimz.finance/' },
  }
  const svc = new AllowanceReminderService(
    prisma as never,
    chain as never,
    { send } as never,
    cfg as never,
  )
  return { svc, send }
}

describe('allowance reminder renew link', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('points at the checkout origin, not the dashboard', async () => {
    vi.stubEnv('STRIMZ_DASHBOARD_URL', 'https://app.strimz.finance')
    const { svc, send } = build()

    await svc.check(sub)

    expect(send).toHaveBeenCalledOnce()
    const [mail] = send.mock.calls[0] ?? []
    const { html } = mail as { html: string }
    expect(html).toContain('https://checkout.strimz.finance/sub/renew/sub_1')
    expect(html).not.toContain('app.strimz.finance/sub/renew')
  })
})
