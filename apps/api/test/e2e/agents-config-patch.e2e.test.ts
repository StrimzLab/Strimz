import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

const VENDOR_A = '0x' + 'a'.repeat(40)
const VENDOR_B = '0x' + 'b'.repeat(40)

const STORED = {
  enabledCapabilities: ['recovery', 'cashflow', 'commerce'],
  recovery: {
    gracePeriodHours: 72,
    strategy: 'once',
    notificationTemplate: 'Your payment failed, please top up.',
  },
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
}

describe('agents config PATCH merges onto the stored config', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.queue.reset()
  })

  async function seedStoredConfig() {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id)
    await t.prisma.db.agentMerchantConfig.create({
      data: {
        merchantId: m.id,
        enabledCapabilities: STORED.enabledCapabilities as never,
        recoveryGracePeriodHours: STORED.recovery.gracePeriodHours,
        recoveryStrategy: STORED.recovery.strategy,
        recoveryNotificationTemplate: STORED.recovery.notificationTemplate,
        cashflowDigestEnabled: STORED.cashflow.digestEnabled,
        cashflowAnomalySensitivity: STORED.cashflow.anomalySensitivity,
        cashflowAutoConvertToYield: STORED.cashflow.autoConvertToYield,
        cashflowMinimumLiquidReserveCents: STORED.cashflow.minimumLiquidReserveCents,
        commerceHumanApprovalAboveUsdCents: STORED.commerce.requireHumanApprovalAboveUsdCents,
        commerceApprovedVendors: STORED.commerce.approvedVendors,
        commerceMonthlySpendCapUsdCents: STORED.commerce.monthlySpendCapUsdCents,
      },
    })
    return k.secretKey
  }

  function patch(secretKey: string, payload: unknown) {
    return t.inject({
      method: 'PATCH',
      url: '/v1/agents/config',
      headers: { authorization: `Bearer ${secretKey}` },
      payload: payload as Record<string, unknown>,
    })
  }

  async function retrieve(secretKey: string) {
    const res = await t.inject({
      method: 'GET',
      url: '/v1/agents/config',
      headers: { authorization: `Bearer ${secretKey}` },
    })
    expect(res.statusCode).toBe(200)
    return JSON.parse(res.body)
  }

  async function expectConfig(secretKey: string, responseBody: string, expected: unknown) {
    const body = JSON.parse(responseBody)
    expect(body).toMatchObject(expected as object)
    expect(await retrieve(secretKey)).toMatchObject(expected as object)
  }

  it('patching one cashflow field leaves its siblings and the other sections unchanged', async () => {
    const key = await seedStoredConfig()
    const res = await patch(key, { cashflow: { digestEnabled: true } })
    expect(res.statusCode).toBe(200)
    await expectConfig(key, res.body, {
      ...STORED,
      cashflow: { ...STORED.cashflow, digestEnabled: true },
    })
  })

  it('patching the spend cap keeps the vendor allowlist and approval threshold', async () => {
    const key = await seedStoredConfig()
    const res = await patch(key, { commerce: { monthlySpendCapUsdCents: 750_000 } })
    expect(res.statusCode).toBe(200)
    await expectConfig(key, res.body, {
      ...STORED,
      commerce: { ...STORED.commerce, monthlySpendCapUsdCents: 750_000 },
    })
  })

  it('patching the recovery strategy alone is accepted and keeps the template', async () => {
    const key = await seedStoredConfig()
    const res = await patch(key, { recovery: { strategy: 'until_grace_ends' } })
    expect(res.statusCode).toBe(200)
    await expectConfig(key, res.body, {
      ...STORED,
      recovery: { ...STORED.recovery, strategy: 'until_grace_ends' },
    })
  })

  it('an empty section is a no-op', async () => {
    const key = await seedStoredConfig()
    const res = await patch(key, { cashflow: {} })
    expect(res.statusCode).toBe(200)
    await expectConfig(key, res.body, STORED)
  })

  it('clears the notification template with an explicit null', async () => {
    const key = await seedStoredConfig()
    const res = await patch(key, { recovery: { notificationTemplate: null } })
    expect(res.statusCode).toBe(200)
    await expectConfig(key, res.body, {
      ...STORED,
      recovery: { ...STORED.recovery, notificationTemplate: null },
    })
  })

  it('clears the monthly spend cap with an explicit null', async () => {
    const key = await seedStoredConfig()
    const res = await patch(key, { commerce: { monthlySpendCapUsdCents: null } })
    expect(res.statusCode).toBe(200)
    await expectConfig(key, res.body, {
      ...STORED,
      commerce: { ...STORED.commerce, monthlySpendCapUsdCents: null },
    })
  })

  it('rejects null for a field that is not nullable and changes nothing', async () => {
    const key = await seedStoredConfig()
    const res = await patch(key, { cashflow: { digestEnabled: null } })
    expect(res.statusCode).toBe(400)
    expect(await retrieve(key)).toMatchObject(STORED)
  })

  it('returns 500 and writes nothing when the stored config fails the schema', async () => {
    const key = await seedStoredConfig()
    const before = await t.prisma.db.agentMerchantConfig.update({
      where: { merchantId: (await t.prisma.db.merchant.findFirstOrThrow()).id },
      data: { recoveryStrategy: 'sometimes' },
    })
    const res = await patch(key, { cashflow: { digestEnabled: true } })
    expect(res.statusCode).toBe(500)
    expect(JSON.parse(res.body).error.code).toBe('internal_error')
    const after = await t.prisma.db.agentMerchantConfig.findUniqueOrThrow({
      where: { merchantId: before.merchantId },
    })
    expect(after).toEqual(before)
  })
})
