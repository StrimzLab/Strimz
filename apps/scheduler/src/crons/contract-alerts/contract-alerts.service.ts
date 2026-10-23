import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { ContractAlertEmail, renderToHtml, type ContractAlertEvent } from '@strimz/email-templates'
import { PLANS, getArcChain, getArcExplorerUrl, type MerchantTier } from '@strimz/shared-config'
import { z } from 'zod'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

const BATCH_LIMIT = 200

const alertMetadataSchema = z.object({
  transactionHash: z.string(),
  contractName: z.string().optional(),
  roleName: z.string().optional(),
  previousAdminRoleName: z.string().optional(),
  newAdminRoleName: z.string().optional(),
  account: z.string().optional(),
  sender: z.string().optional(),
  implementation: z.string().optional(),
  operationId: z.string().optional(),
  target: z.string().optional(),
  value: z.string().optional(),
  data: z.string().optional(),
  delay: z.string().optional(),
  oldDuration: z.string().optional(),
  newDuration: z.string().optional(),
  merchantId: z.string().optional(),
  businessName: z.string().nullish(),
  tier: z.enum(Object.keys(PLANS) as [MerchantTier, ...MerchantTier[]]).optional(),
  planFeeBps: z.number().int().optional(),
  onchainFeeBps: z.number().int().optional(),
  onchainMerchantId: z.string().optional(),
  direction: z.enum(['below_plan', 'above_plan']).optional(),
})

type AlertMetadata = z.infer<typeof alertMetadataSchema>

const EVENT_TITLES: Record<string, (m: AlertMetadata) => string> = {
  'contract.role_granted': (m) => `${m.roleName ?? 'role'} granted`,
  'contract.role_revoked': (m) => `${m.roleName ?? 'role'} revoked`,
  'contract.role_admin_changed': (m) =>
    `${m.roleName ?? 'role'} now administered by ${m.newAdminRoleName ?? 'another role'}`,
  'contract.upgraded': () => 'implementation upgraded',
  'contract.paused': () => 'paused',
  'contract.unpaused': () => 'unpaused',
  'timelock.call_scheduled': () => 'call scheduled',
  'timelock.call_executed': () => 'call executed',
  'timelock.cancelled': () => 'scheduled call cancelled',
  'timelock.min_delay_changed': () => 'minimum delay changed',
}

export interface ContractAlertResult {
  sent: number
  failed: boolean
}

@Injectable()
export class ContractAlertService {
  private readonly log = new Logger(ContractAlertService.name)
  private running = false

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly email: EmailService,
  ) {}

  @Cron(process.env.CONTRACT_ALERT_CRON || '0 * * * * *', { name: 'contract-alerts' })
  tick(): Promise<ContractAlertResult> {
    return this.sendNow()
  }

  async sendNow(): Promise<ContractAlertResult> {
    if (this.running) return { sent: 0, failed: false }
    this.running = true
    try {
      return await this.send()
    } finally {
      this.running = false
    }
  }

  private async send(): Promise<ContractAlertResult> {
    const environment = this.cfg.env.ARC_ENVIRONMENT
    const rows = await this.prisma.db.contractAlert.findMany({
      where: { alertedAt: null, chainId: getArcChain(environment).id },
      include: { auditLog: true },
      orderBy: { createdAt: 'asc' },
      take: BATCH_LIMIT,
    })
    if (rows.length === 0) return { sent: 0, failed: false }

    const network = environment === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'
    const explorer = getArcExplorerUrl(environment)
    const events = rows.map((row) =>
      this.describe(
        row.auditLog.action,
        alertMetadataSchema.parse(row.auditLog.metadata),
        explorer,
      ),
    )

    try {
      const html = await renderToHtml(ContractAlertEmail({ network, events }))
      await this.email.send({
        to: this.cfg.env.STRIMZ_ADMIN_ALERT_EMAIL,
        subject: `[Strimz] Contract alert: ${rows.length} on-chain admin ${rows.length === 1 ? 'event' : 'events'} on ${network}`,
        html,
      })
    } catch (err) {
      this.log.error(
        `contract alert email failed; ${rows.length} events stay pending: ${(err as Error).message}`,
      )
      return { sent: 0, failed: true }
    }

    await this.prisma.db.contractAlert.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { alertedAt: new Date() },
    })
    this.log.warn(`contract alert: emailed ${rows.length} on-chain admin events`)
    return { sent: rows.length, failed: false }
  }

  private describe(action: string, m: AlertMetadata, explorer: string): ContractAlertEvent {
    if (action === 'merchant.fee_drift') return this.describeFeeDrift(m, explorer)
    const title = EVENT_TITLES[action]?.(m) ?? action
    const details: Array<[string, string]> = []
    const add = (label: string, value: string | undefined, labelled = false) => {
      if (value !== undefined) details.push([label, labelled ? this.label(value) : value])
    }
    add('Account', m.account, true)
    add('Sent by', m.sender, true)
    add('Previous admin role', m.previousAdminRoleName)
    add('New implementation', m.implementation)
    add('Operation', m.operationId)
    add('Target', m.target)
    add('Value', m.value)
    add('Call data', m.data)
    add('Delay (seconds)', m.delay)
    add('Old delay (seconds)', m.oldDuration)
    add('New delay (seconds)', m.newDuration)
    return {
      title: `${m.contractName ?? 'Unknown contract'}: ${title}`,
      details,
      txUrl: `${explorer}/tx/${m.transactionHash}`,
    }
  }

  private describeFeeDrift(m: AlertMetadata, explorer: string): ContractAlertEvent {
    const percent = (bps: number | undefined) => (bps === undefined ? 'unknown' : `${bps / 100}%`)
    const details: Array<[string, string]> = [
      [
        'Merchant',
        m.businessName ? `${m.businessName} (${m.merchantId})` : (m.merchantId ?? 'unknown'),
      ],
      ['On-chain merchant id', m.onchainMerchantId ?? 'unknown'],
      ['Plan', m.tier ? `${PLANS[m.tier].name} (${percent(m.planFeeBps)})` : 'unknown'],
      ['Fee on the chain', percent(m.onchainFeeBps)],
      [
        'Effect',
        m.direction === 'above_plan'
          ? 'The merchant pays more than their plan'
          : 'Strimz collects less than the plan',
      ],
    ]
    return {
      title: 'Merchant fee differs from plan',
      details,
      txUrl: `${explorer}/tx/${m.transactionHash}`,
    }
  }

  private label(address: string): string {
    const lower = address.toLowerCase()
    if (lower === this.cfg.env.RELAYER_ADDRESS.toLowerCase()) return `${address} (relayer)`
    if (lower === this.chain.account.address.toLowerCase()) return `${address} (scheduler)`
    return address
  }
}
