import { describe, expect, it } from 'vitest'
import { updateAgentConfigInputSchema, type AgentMerchantConfig } from '@strimz/shared-types'

import { mergeAgentConfig } from '../../../../src/modules/agents/agent-config-merge.js'

const VENDOR_A = '0x' + 'a'.repeat(40)
const VENDOR_B = '0x' + 'b'.repeat(40)
const VENDOR_C = '0x' + 'c'.repeat(40)

const STORED: AgentMerchantConfig = {
  merchantId: 'mer_1',
  enabledCapabilities: ['recovery', 'commerce'],
  recovery: { gracePeriodHours: 72, strategy: 'once', notificationTemplate: 'Top up, please.' },
  cashflow: {
    digestEnabled: false,
    anomalySensitivity: 'high',
    autoConvertToYield: true,
    minimumLiquidReserveCents: 250_000,
  },
  commerce: {
    requireHumanApprovalAboveUsdCents: 20_000,
    approvedVendors: [VENDOR_A, VENDOR_B],
    monthlySpendCapUsdCents: 500_000,
  },
  updatedAt: '2026-10-01T00:00:00.000Z',
}

function merge(body: unknown) {
  return mergeAgentConfig(STORED, updateAgentConfigInputSchema.parse(body))
}

describe('mergeAgentConfig', () => {
  it('returns the stored config for an empty patch and for empty sections', () => {
    expect(merge({})).toEqual(STORED)
    expect(merge({ recovery: {}, cashflow: {}, commerce: {} })).toEqual(STORED)
  })

  it('changes only the fields the patch names', () => {
    expect(merge({ cashflow: { digestEnabled: true } })).toEqual({
      ...STORED,
      cashflow: { ...STORED.cashflow, digestEnabled: true },
    })
    expect(merge({ commerce: { monthlySpendCapUsdCents: 750_000 } })).toEqual({
      ...STORED,
      commerce: { ...STORED.commerce, monthlySpendCapUsdCents: 750_000 },
    })
  })

  it('clears the nullable fields with null', () => {
    expect(
      merge({
        recovery: { notificationTemplate: null },
        commerce: { monthlySpendCapUsdCents: null },
      }),
    ).toEqual({
      ...STORED,
      recovery: { ...STORED.recovery, notificationTemplate: null },
      commerce: { ...STORED.commerce, monthlySpendCapUsdCents: null },
    })
  })

  it('replaces arrays whole', () => {
    expect(
      merge({ enabledCapabilities: ['cashflow'], commerce: { approvedVendors: [VENDOR_C] } }),
    ).toEqual({
      ...STORED,
      enabledCapabilities: ['cashflow'],
      commerce: { ...STORED.commerce, approvedVendors: [VENDOR_C] },
    })
  })

  it('clears arrays with an empty array', () => {
    expect(merge({ enabledCapabilities: [], commerce: { approvedVendors: [] } })).toEqual({
      ...STORED,
      enabledCapabilities: [],
      commerce: { ...STORED.commerce, approvedVendors: [] },
    })
  })

  it('keeps a stored value when the patch carries an undefined key', () => {
    expect(mergeAgentConfig(STORED, { cashflow: { digestEnabled: undefined } })).toEqual(STORED)
  })

  it('does not mutate the stored config', () => {
    const snapshot = structuredClone(STORED)
    merge({ recovery: { strategy: 'twice' }, commerce: { approvedVendors: [] } })
    expect(STORED).toEqual(snapshot)
  })
})
