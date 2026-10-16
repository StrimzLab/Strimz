import { describe, expect, it } from 'vitest'
import { agentMerchantConfigSchema, updateAgentConfigInputSchema } from '../src/index.js'

const SECTIONS = ['recovery', 'cashflow', 'commerce'] as const

describe('updateAgentConfigInputSchema', () => {
  it('parses a one-field section to exactly that field', () => {
    expect(updateAgentConfigInputSchema.parse({ cashflow: { digestEnabled: true } })).toEqual({
      cashflow: { digestEnabled: true },
    })
    expect(
      updateAgentConfigInputSchema.parse({ commerce: { monthlySpendCapUsdCents: 5000 } }),
    ).toEqual({ commerce: { monthlySpendCapUsdCents: 5000 } })
    expect(updateAgentConfigInputSchema.parse({ recovery: { strategy: 'once' } })).toEqual({
      recovery: { strategy: 'once' },
    })
  })

  it('parses an empty body and an empty section without adding defaults', () => {
    expect(updateAgentConfigInputSchema.parse({})).toEqual({})
    expect(updateAgentConfigInputSchema.parse({ cashflow: {} })).toEqual({ cashflow: {} })
  })

  it('accepts null only on the two nullable fields', () => {
    expect(
      updateAgentConfigInputSchema.parse({ recovery: { notificationTemplate: null } }),
    ).toEqual({ recovery: { notificationTemplate: null } })
    expect(
      updateAgentConfigInputSchema.parse({ commerce: { monthlySpendCapUsdCents: null } }),
    ).toEqual({ commerce: { monthlySpendCapUsdCents: null } })

    const rejected = [
      { enabledCapabilities: null },
      { recovery: null },
      { recovery: { gracePeriodHours: null } },
      { recovery: { strategy: null } },
      { cashflow: { digestEnabled: null } },
      { cashflow: { anomalySensitivity: null } },
      { cashflow: { autoConvertToYield: null } },
      { cashflow: { minimumLiquidReserveCents: null } },
      { commerce: { requireHumanApprovalAboveUsdCents: null } },
      { commerce: { approvedVendors: null } },
    ]
    for (const body of rejected) {
      expect(updateAgentConfigInputSchema.safeParse(body).success, JSON.stringify(body)).toBe(false)
    }
  })

  it('keeps the field rules of the full schema', () => {
    expect(
      updateAgentConfigInputSchema.safeParse({ recovery: { gracePeriodHours: 36 } }).success,
    ).toBe(false)
    expect(
      updateAgentConfigInputSchema.safeParse({ cashflow: { minimumLiquidReserveCents: -1 } })
        .success,
    ).toBe(false)
    expect(
      updateAgentConfigInputSchema.safeParse({ commerce: { approvedVendors: ['0x1234'] } }).success,
    ).toBe(false)
  })

  it('replaces arrays as sent, including an empty array', () => {
    expect(
      updateAgentConfigInputSchema.parse({
        enabledCapabilities: [],
        commerce: { approvedVendors: [] },
      }),
    ).toEqual({ enabledCapabilities: [], commerce: { approvedVendors: [] } })
  })

  it('has the same keys as the full schema minus merchantId and updatedAt', () => {
    const full = agentMerchantConfigSchema.omit({ merchantId: true, updatedAt: true }).shape
    const update = updateAgentConfigInputSchema.shape
    expect(Object.keys(update).sort()).toEqual(Object.keys(full).sort())
    for (const section of SECTIONS) {
      expect(Object.keys(update[section].unwrap().shape).sort()).toEqual(
        Object.keys(full[section].shape).sort(),
      )
    }
  })
})
