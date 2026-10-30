import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { must } from '../helpers/must.js'
import { MerchantNotificationsService } from '../../src/crons/merchant-notifications/merchant-notifications.service.js'

const CHAIN_ID = 5042002
const NEW_PAYOUT = '0x00000000000000000000000000000000000000d1'
const NOMINEE = '0x00000000000000000000000000000000000000c2'
// 2026-11-01T12:00:00Z
const EFFECTIVE_AT = 1_793_534_400

describe('merchant security alerts e2e', () => {
  let t: TestApp
  let seq = 0

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

  const run = () => t.app.get(MerchantNotificationsService).tickNow()

  async function seedSecurityAlert(
    merchantId: string,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    seq++
    const txHash = `0x${seq.toString(16).padStart(64, '0')}`
    const auditLogId = `onchain:${CHAIN_ID}:${txHash}:0`
    await t.prisma.db.auditLog.create({
      data: {
        id: auditLogId,
        merchantId,
        category: 'merchant',
        action,
        targetType: 'Merchant',
        targetId: merchantId,
        metadata: {
          transactionHash: txHash,
          logIndex: 0,
          blockNumber: 11,
          onchainMerchantId: '7',
          ...metadata,
        },
      },
    })
    await t.prisma.db.merchantSecurityAlert.create({ data: { auditLogId, merchantId } })
    return { auditLogId, txHash }
  }

  function securityEmails(merchantEmail: string) {
    // The welcome lane also emails a new merchant; only the security emails matter here.
    return t.email.sent.filter((m) => m.to === merchantEmail && m.subject !== 'Welcome to Strimz')
  }

  const pending = () => t.prisma.db.merchantSecurityAlert.count({ where: { notifiedAt: null } })

  it('emails the merchant about a payout change once, with the new address, the time and a cancel link', async () => {
    const m = await seedMerchant(t.prisma.db, { id: 'm_payout', onchainMerchantId: 7 })
    const { txHash } = await seedSecurityAlert(m.id, 'merchant.payout_change_initiated_onchain', {
      newPayoutAddress: NEW_PAYOUT,
      commitAt: EFFECTIVE_AT,
    })

    await run()

    const mails = securityEmails(m.email)
    expect(mails).toHaveLength(1)
    const mail = must(mails[0])
    expect(mail.subject).toBe('Your Strimz payout address is changing')
    expect(mail.html).toContain(NEW_PAYOUT)
    expect(mail.html).toContain('1 Nov 2026, 12:00 UTC')
    expect(mail.html).toContain('/app/settings')
    expect(mail.html).toContain(`/tx/${txHash}`)
    expect(await pending()).toBe(0)

    await run()
    expect(securityEmails(m.email)).toHaveLength(1)
  })

  it('emails the merchant about an ownership hand-over with the nominee and a support contact', async () => {
    const m = await seedMerchant(t.prisma.db, { id: 'm_owner', onchainMerchantId: 7 })
    await seedSecurityAlert(m.id, 'merchant.ownership_transfer_initiated_onchain', {
      currentOwner: '0x00000000000000000000000000000000000000c1',
      pendingOwner: NOMINEE,
      acceptableAt: EFFECTIVE_AT,
    })

    await run()

    const mails = securityEmails(m.email)
    expect(mails).toHaveLength(1)
    const mail = must(mails[0])
    expect(mail.subject).toBe('Your Strimz merchant account is being handed over')
    expect(mail.html).toContain(NOMINEE)
    expect(mail.html).toContain('1 Nov 2026, 12:00 UTC')
    expect(mail.html).toContain('support@strimz.finance')
  })

  it('leaves the alert pending when the email fails, and sends it next time', async () => {
    const m = await seedMerchant(t.prisma.db, { id: 'm_retry', onchainMerchantId: 7 })
    await t.prisma.db.merchant.update({
      where: { id: m.id },
      data: { welcomeNotifiedAt: new Date() },
    })
    await seedSecurityAlert(m.id, 'merchant.payout_change_initiated_onchain', {
      newPayoutAddress: NEW_PAYOUT,
      commitAt: EFFECTIVE_AT,
    })
    t.email.failNext = true

    await run()
    expect(await pending()).toBe(1)

    await run()
    expect(await pending()).toBe(0)
    expect(securityEmails(m.email)).toHaveLength(1)
  })
})
