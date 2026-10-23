import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { getArcChain, planFeeBps, type MerchantTier } from '@strimz/shared-config'

import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

// Plan upgrades change the registry a few seconds before the tier column.
const GRACE_MS = 15 * 60_000

export type FeeDriftDirection = 'below_plan' | 'above_plan'

export interface FeeDriftResult {
  checked: number
  drifted: number
}

@Injectable()
export class FeeDriftService {
  private readonly log = new Logger(FeeDriftService.name)
  private running = false

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(process.env.FEE_DRIFT_CRON || '0 */5 * * * *', { name: 'fee-drift' })
  tick(): Promise<FeeDriftResult> {
    return this.checkNow()
  }

  async checkNow(): Promise<FeeDriftResult> {
    if (this.running) return { checked: 0, drifted: 0 }
    this.running = true
    try {
      return await this.check()
    } finally {
      this.running = false
    }
  }

  private async check(): Promise<FeeDriftResult> {
    const chainId = getArcChain(this.cfg.env.ARC_ENVIRONMENT).id
    const merchants = await this.prisma.db.merchant.findMany({
      where: {
        onchainMerchantId: { not: null },
        onchainFeeBps: { not: null },
        onchainFeeTxHash: { not: null },
        onchainFeeChangedAt: { lt: new Date(Date.now() - GRACE_MS) },
        tier: { not: 'enterprise' },
      },
      select: {
        id: true,
        businessName: true,
        tier: true,
        onchainMerchantId: true,
        onchainFeeBps: true,
        onchainFeeTxHash: true,
        onchainFeeChangedAt: true,
      },
    })

    let drifted = 0
    for (const m of merchants) {
      const planFee = planFeeBps(m.tier)
      const onchainFee = m.onchainFeeBps
      const changedAt = m.onchainFeeChangedAt
      const txHash = m.onchainFeeTxHash
      if (planFee === null || onchainFee === null || changedAt === null || txHash === null) continue
      if (planFee === onchainFee) continue
      drifted++
      await this.record(chainId, {
        merchantId: m.id,
        businessName: m.businessName,
        tier: m.tier,
        planFeeBps: planFee,
        onchainFeeBps: onchainFee,
        onchainMerchantId: String(m.onchainMerchantId),
        transactionHash: txHash,
        changedAt,
      })
    }
    if (drifted > 0) this.log.warn(`fee-drift: ${drifted} merchants differ from their plan fee`)
    return { checked: merchants.length, drifted }
  }

  private async record(
    chainId: number,
    d: {
      merchantId: string
      businessName: string | null
      tier: MerchantTier
      planFeeBps: number
      onchainFeeBps: number
      onchainMerchantId: string
      transactionHash: string
      changedAt: Date
    },
  ): Promise<void> {
    const auditLogId = `fee-drift:${d.merchantId}:${d.tier}:${d.onchainFeeBps}:${d.changedAt.getTime()}`
    const direction: FeeDriftDirection =
      d.onchainFeeBps < d.planFeeBps ? 'below_plan' : 'above_plan'
    await this.prisma.db.$transaction([
      this.prisma.db.auditLog.createMany({
        data: {
          id: auditLogId,
          merchantId: d.merchantId,
          category: 'merchant',
          action: 'merchant.fee_drift',
          targetType: 'Merchant',
          targetId: d.merchantId,
          metadata: {
            merchantId: d.merchantId,
            businessName: d.businessName,
            tier: d.tier,
            planFeeBps: d.planFeeBps,
            onchainFeeBps: d.onchainFeeBps,
            direction,
            onchainMerchantId: d.onchainMerchantId,
            transactionHash: d.transactionHash,
          },
        },
        skipDuplicates: true,
      }),
      this.prisma.db.contractAlert.createMany({
        data: { auditLogId, chainId },
        skipDuplicates: true,
      }),
    ])
  }
}
