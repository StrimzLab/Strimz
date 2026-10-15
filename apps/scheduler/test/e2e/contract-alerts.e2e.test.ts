import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { ContractAlertService } from '../../src/crons/contract-alerts/contract-alerts.service.js'
import { must } from '../helpers/must.js'

const CHAIN_ID = 5042002
const RELAYER = '0x000000000000000000000000000000000000dead'
const ATTACKER = '0x00000000000000000000000000000000000000f2'
const REGISTRY = '0x0000000000000000000000000000000000000b01'

describe('contract alerts e2e', () => {
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

  const run = () => t.app.get(ContractAlertService).sendNow()

  async function seedAlert(
    action: string,
    metadata: Record<string, unknown>,
    alertedAt: Date | null = null,
    chainId = CHAIN_ID,
  ) {
    seq++
    const txHash = `0x${seq.toString(16).padStart(64, '0')}`
    const auditLogId = `onchain:${CHAIN_ID}:${txHash}:0`
    await t.prisma.db.auditLog.create({
      data: {
        id: auditLogId,
        category: 'admin',
        action,
        targetType: 'Contract',
        targetId: REGISTRY,
        metadata: { transactionHash: txHash, logIndex: 0, blockNumber: 11, ...metadata },
      },
    })
    await t.prisma.db.contractAlert.create({
      data: { auditLogId, chainId, alertedAt },
    })
    return { auditLogId, txHash }
  }

  const pending = () => t.prisma.db.contractAlert.count({ where: { alertedAt: null } })

  it('emails every pending event in one message to the ops address and stamps them', async () => {
    const granted = await seedAlert('contract.role_granted', {
      contractName: 'StrimzRegistry',
      roleName: 'FEE_MANAGER_ROLE',
      account: ATTACKER,
      sender: RELAYER,
    })
    await seedAlert('contract.upgraded', {
      contractName: 'TokenWhitelist',
      implementation: '0x00000000000000000000000000000000000000f3',
    })

    const result = await run()

    expect(result).toEqual({ sent: 2, failed: false })
    expect(t.email.sent).toHaveLength(1)
    const mail = must(t.email.sent[0])
    expect(mail.to).toBe('ops@strimz.test')
    expect(mail.subject).toContain('2 on-chain admin events')
    expect(mail.subject).toContain('Arc Testnet')
    expect(mail.html).toContain('StrimzRegistry')
    expect(mail.html).toContain('FEE_MANAGER_ROLE')
    expect(mail.html).toContain(ATTACKER)
    expect(mail.html).toContain('TokenWhitelist')
    expect(mail.html).toContain(`/tx/${granted.txHash}`)
    expect(mail.html).toContain('relayer')
    expect(await pending()).toBe(0)
  })

  it('leaves the events pending when the email fails, and sends them next time', async () => {
    await seedAlert('contract.paused', { contractName: 'StrimzPayments', account: ATTACKER })
    t.email.failNext = true

    expect(await run()).toEqual({ sent: 0, failed: true })
    expect(await pending()).toBe(1)

    expect(await run()).toEqual({ sent: 1, failed: false })
    expect(await pending()).toBe(0)
  })

  it('sends nothing when no event is pending', async () => {
    await seedAlert('contract.paused', { contractName: 'StrimzPayments' }, new Date())

    expect(await run()).toEqual({ sent: 0, failed: false })
    expect(t.email.sent).toHaveLength(0)
  })

  it('leaves events from another network for that network to send', async () => {
    await seedAlert('contract.paused', { contractName: 'StrimzPayments' }, null, 5042)

    expect(await run()).toEqual({ sent: 0, failed: false })
    expect(t.email.sent).toHaveLength(0)
    expect(await pending()).toBe(1)
  })
})
