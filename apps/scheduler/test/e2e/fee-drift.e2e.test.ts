import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { MerchantTier } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { FeeDriftService } from '../../src/crons/fee-drift/fee-drift.service.js'
import { ContractAlertService } from '../../src/crons/contract-alerts/contract-alerts.service.js'
import { must } from '../helpers/must.js'

const CHAIN_ID = 5042002
const MINUTE = 60_000
const FEE_TX = `0x${'7'.repeat(64)}`

describe('merchant fee drift e2e', () => {
  let t: TestApp
  let onchainId = 1

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.email.reset()
  })

  const run = () => t.app.get(FeeDriftService).checkNow()

  async function merchant(
    tier: MerchantTier,
    onchainFeeBps: number | null,
    changedMinutesAgo = 30,
  ) {
    const m = await seedMerchant(t.prisma.db, { tier, onchainMerchantId: onchainId++ })
    await t.prisma.db.merchant.update({
      where: { id: m.id },
      data: {
        onchainFeeBps,
        onchainMaxFeeBps: onchainFeeBps === null ? null : 50,
        onchainFeeTxHash: onchainFeeBps === null ? null : FEE_TX,
        onchainFeeChangedAt:
          onchainFeeBps === null ? null : new Date(Date.now() - changedMinutesAgo * MINUTE),
      },
    })
    return m.id as string
  }

  const driftRows = (merchantId?: string) =>
    t.prisma.db.auditLog.findMany({
      where: { action: 'merchant.fee_drift', ...(merchantId ? { merchantId } : {}) },
      include: { contractAlert: true },
    })

  it('alerts once when the chain charges less than the plan', async () => {
    const id = await merchant('starter', 0)

    expect(await run()).toEqual({ checked: 1, drifted: 1 })
    const rows = await driftRows(id)
    expect(rows).toHaveLength(1)
    const row = must(rows[0])
    expect(row.category).toBe('merchant')
    expect(row.targetType).toBe('Merchant')
    expect(row.targetId).toBe(id)
    expect(row.metadata).toMatchObject({
      tier: 'starter',
      planFeeBps: 50,
      onchainFeeBps: 0,
      direction: 'below_plan',
      transactionHash: FEE_TX,
    })
    expect(row.contractAlert).toMatchObject({ chainId: CHAIN_ID, alertedAt: null })

    expect(await run()).toEqual({ checked: 1, drifted: 1 })
    expect(await driftRows(id)).toHaveLength(1)
  })

  it('alerts when the chain charges more than the plan', async () => {
    const id = await merchant('free', 50)

    await run()
    const row = must((await driftRows(id))[0])
    expect(row.metadata).toMatchObject({
      tier: 'free',
      planFeeBps: 0,
      onchainFeeBps: 50,
      direction: 'above_plan',
    })
  })

  it('stays quiet when the fee matches, is unknown, is Enterprise, or changed within 15 minutes', async () => {
    await merchant('growth', 40)
    await merchant('starter', null)
    await merchant('enterprise', 25)
    await merchant('growth', 50, 5)

    expect(await run()).toEqual({ checked: 1, drifted: 0 })
    expect(await driftRows()).toHaveLength(0)
  })

  it('alerts again after the fee changes and still differs', async () => {
    const id = await merchant('starter', 0)
    await run()
    await t.prisma.db.merchant.update({
      where: { id },
      data: { onchainFeeBps: 40, onchainFeeChangedAt: new Date(Date.now() - 20 * MINUTE) },
    })

    await run()
    const rows = await driftRows(id)
    expect(rows.map((r) => (r.metadata as { onchainFeeBps: number }).onchainFeeBps).sort()).toEqual(
      [0, 40],
    )
  })

  it('reaches the ops inbox through the contract alert email', async () => {
    const id = await merchant('starter', 0)
    await run()

    expect(await t.app.get(ContractAlertService).sendNow()).toEqual({ sent: 1, failed: false })
    const mail = must(t.email.sent[0])
    expect(mail.html).toContain('Merchant fee differs from plan')
    expect(mail.html).toContain(id)
    expect(mail.html).toContain('Starter')
    expect(mail.html).toContain('0.5%')
    expect(mail.html).toContain('0%')
    expect(mail.html).toContain(`/tx/${FEE_TX}`)
  })
})
