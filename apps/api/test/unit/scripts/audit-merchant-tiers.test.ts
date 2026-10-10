import { describe, expect, it } from 'vitest'

import { auditMerchantTiers } from '../../../scripts/audit-merchant-tiers.mjs'

const merchant = (
  id: string,
  tier: 'free' | 'growth' | 'business' | 'enterprise',
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
      merchants: [merchant('m_free', 'free', null), merchant('m_self', 'growth', null)],
      tierChanges: [],
      registry: new Map(),
    })

    expect(report.nonFreeTiers).toEqual([
      {
        merchantId: 'm_self',
        email: 'm_self@strimz.test',
        tier: 'growth',
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
      merchants: [merchant('m_admin', 'business', 9), merchant('m_moved', 'growth', null)],
      tierChanges: [
        tierChange('m_admin', 'business', '2026-10-01T00:00:00Z'),
        tierChange('m_moved', 'growth', '2026-10-01T00:00:00Z'),
        tierChange('m_moved', 'business', '2026-10-02T00:00:00Z'),
      ],
      registry: new Map([['9', { feeBps: 50, maxFeeBps: 150 }]]),
    })

    const byId = Object.fromEntries(report.nonFreeTiers.map((row) => [row.merchantId, row]))
    expect(byId.m_admin).toMatchObject({ explainedByAdmin: true, suggestion: 'none' })
    expect(byId.m_admin?.lastAdminTierChange).toMatchObject({
      actorId: 'admin_1',
      next: 'business',
    })
    expect(byId.m_moved).toMatchObject({ explainedByAdmin: false, suggestion: 'reset_to_free' })
  })

  it('flags a registered merchant whose on-chain fee differs from or is below its tier fee', () => {
    const report = auditMerchantTiers({
      merchants: [
        merchant('m_ok', 'free', 1),
        merchant('m_cheap', 'free', 2),
        merchant('m_custom', 'enterprise', 3),
      ],
      tierChanges: [tierChange('m_custom', 'enterprise', '2026-10-01T00:00:00Z')],
      registry: new Map([
        ['1', { feeBps: 150, maxFeeBps: 150 }],
        ['2', { feeBps: 50, maxFeeBps: 50 }],
        ['3', { feeBps: 20, maxFeeBps: 150 }],
      ]),
    })

    expect(report.registered).toEqual([
      {
        merchantId: 'm_ok',
        onchainMerchantId: '1',
        tier: 'free',
        tierFeeBps: 150,
        onchainFeeBps: 150,
        maxFeeBps: 150,
        tiersAcceptedByAdminRoute: ['free', 'enterprise'],
        flags: [],
      },
      {
        merchantId: 'm_cheap',
        onchainMerchantId: '2',
        tier: 'free',
        tierFeeBps: 150,
        onchainFeeBps: 50,
        maxFeeBps: 50,
        tiersAcceptedByAdminRoute: ['business', 'enterprise'],
        flags: ['fee_mismatch', 'fee_below_tier', 'ceiling_below_default'],
      },
      {
        merchantId: 'm_custom',
        onchainMerchantId: '3',
        tier: 'enterprise',
        tierFeeBps: null,
        onchainFeeBps: 20,
        maxFeeBps: 150,
        tiersAcceptedByAdminRoute: ['enterprise'],
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
