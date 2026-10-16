import { describe, expect, it } from 'vitest'

import { auditMerchantTiers } from '../../../scripts/audit-merchant-tiers.mjs'

const merchant = (
  id: string,
  tier: 'free' | 'starter' | 'growth' | 'enterprise',
  onchainMerchantId: number | null,
) => ({ id, email: `${id}@strimz.test`, tier, onchainMerchantId })

const tierChange = (targetId: string, next: string, createdAt: string) => ({
  targetId,
  actorId: 'admin_1',
  createdAt: new Date(createdAt),
  metadata: { previous: 'free', next },
})

describe('auditMerchantTiers', () => {
  it('lists a non-free tier with no admin change as unexplained and resets it to free when unregistered', () => {
    const report = auditMerchantTiers({
      merchants: [merchant('m_free', 'free', null), merchant('m_self', 'starter', null)],
      tierChanges: [],
      registry: new Map(),
    })

    expect(report.nonFreeTiers).toEqual([
      {
        merchantId: 'm_self',
        email: 'm_self@strimz.test',
        tier: 'starter',
        onchainMerchantId: null,
        lastAdminTierChange: null,
        explainedByAdmin: false,
        suggestion: 'reset_to_free',
      },
    ])
    expect(report.registered).toEqual([])
  })

  it('counts a non-free tier as explained only when the latest admin change set that tier', () => {
    const report = auditMerchantTiers({
      merchants: [merchant('m_admin', 'enterprise', 9), merchant('m_moved', 'starter', null)],
      tierChanges: [
        tierChange('m_admin', 'enterprise', '2026-10-01T00:00:00Z'),
        tierChange('m_moved', 'starter', '2026-10-01T00:00:00Z'),
        tierChange('m_moved', 'enterprise', '2026-10-02T00:00:00Z'),
      ],
      registry: new Map([['9', { feeBps: 25, maxFeeBps: 50 }]]),
    })

    const byId = Object.fromEntries(report.nonFreeTiers.map((row) => [row.merchantId, row]))
    expect(byId.m_admin).toMatchObject({ explainedByAdmin: true, suggestion: 'none' })
    expect(byId.m_admin?.lastAdminTierChange).toMatchObject({
      actorId: 'admin_1',
      next: 'enterprise',
    })
    expect(byId.m_moved).toMatchObject({ explainedByAdmin: false, suggestion: 'reset_to_free' })
  })

  it('flags a registered merchant whose on-chain fee differs from or is below its plan fee', () => {
    const report = auditMerchantTiers({
      merchants: [
        merchant('m_ok', 'free', 1),
        merchant('m_cheap', 'starter', 2),
        merchant('m_custom', 'enterprise', 3),
      ],
      tierChanges: [
        tierChange('m_cheap', 'starter', '2026-10-01T00:00:00Z'),
        tierChange('m_custom', 'enterprise', '2026-10-01T00:00:00Z'),
      ],
      registry: new Map([
        ['1', { feeBps: 0, maxFeeBps: 50 }],
        ['2', { feeBps: 0, maxFeeBps: 0 }],
        ['3', { feeBps: 20, maxFeeBps: 50 }],
      ]),
    })

    expect(report.registered).toEqual([
      {
        merchantId: 'm_ok',
        onchainMerchantId: '1',
        tier: 'free',
        tierFeeBps: 0,
        onchainFeeBps: 0,
        maxFeeBps: 50,
        flags: [],
      },
      {
        merchantId: 'm_cheap',
        onchainMerchantId: '2',
        tier: 'starter',
        tierFeeBps: 50,
        onchainFeeBps: 0,
        maxFeeBps: 0,
        flags: ['fee_mismatch', 'fee_below_tier', 'ceiling_below_plan_ceiling'],
      },
      {
        merchantId: 'm_custom',
        onchainMerchantId: '3',
        tier: 'enterprise',
        tierFeeBps: null,
        onchainFeeBps: 20,
        maxFeeBps: 50,
        flags: [],
      },
    ])
    expect(report.flaggedCount).toBe(1)
  })

  it('refuses to report a registered merchant whose registry record was not read', () => {
    expect(() =>
      auditMerchantTiers({
        merchants: [merchant('m_lost', 'free', 4)],
        tierChanges: [],
        registry: new Map(),
      }),
    ).toThrow(/4/)
  })
})
