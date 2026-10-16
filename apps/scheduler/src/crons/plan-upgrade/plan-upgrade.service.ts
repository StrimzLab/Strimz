import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PlanUpgradedEmail, STRIMZ_ORIGIN, renderToHtml } from '@strimz/email-templates'
import {
  PAYMENT_TOKENS,
  PLANS,
  TOKENS,
  arcModeFor,
  getArcExplorerUrl,
  planFeeBps,
  planIncludes,
  planUpgradeFor,
  type MerchantTier,
  type PaymentToken,
  type PaymentVolumes,
  type PlanFeature,
  type VolumePlan,
} from '@strimz/shared-config'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

const FEATURE_NAMES: Record<PlanFeature, string> = {
  storefront: 'Storefront builder',
  anomaly_alerts: 'Anomaly alerts',
  yield_recommendations: 'Yield recommendations',
}

interface VolumeRow {
  id: string
  email: string
  businessName: string | null
  onchainMerchantId: number
  tier: MerchantTier
  currency: PaymentToken
  volume: string
}

interface Candidate {
  id: string
  email: string
  businessName: string | null
  onchainMerchantId: bigint
  tier: MerchantTier
  volumes: Record<PaymentToken, bigint>
}

interface Upgrade {
  candidate: Candidate
  next: VolumePlan
  feeBps: number
  txHash: `0x${string}` | null
}

export interface PlanUpgradeResult {
  checked: number
  upgraded: number
  failed: number
  emailFailed: number
}

@Injectable()
export class PlanUpgradeService {
  private readonly log = new Logger(PlanUpgradeService.name)
  private running = false

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly prisma: PrismaService,
    private readonly chain: ChainService,
    private readonly email: EmailService,
  ) {}

  @Cron(process.env.PLAN_UPGRADE_CRON || '0 */5 * * * *', { name: 'plan-upgrade' })
  tick(): Promise<PlanUpgradeResult> {
    return this.upgradeNow()
  }

  async upgradeNow(): Promise<PlanUpgradeResult> {
    const result: PlanUpgradeResult = { checked: 0, upgraded: 0, failed: 0, emailFailed: 0 }
    if (this.running) return result
    this.running = true
    try {
      for (const candidate of await this.candidates()) {
        const next = planUpgradeFor(candidate.tier, candidate.volumes)
        if (!next) continue
        result.checked++
        let upgrade: Upgrade | null
        try {
          upgrade = await this.upgrade(candidate, next)
        } catch (err) {
          result.failed++
          this.log.error(
            `plan upgrade ${candidate.tier} -> ${next} failed for merchant ${candidate.id}: ${(err as Error).message}`,
          )
          continue
        }
        if (!upgrade) continue
        result.upgraded++
        if (!(await this.notify(upgrade))) result.emailFailed++
      }
    } finally {
      this.running = false
    }
    if (result.checked > 0) {
      this.log.log(
        `plan-upgrade: upgraded=${result.upgraded} failed=${result.failed} emailFailed=${result.emailFailed}`,
      )
    }
    return result
  }

  private async candidates(): Promise<Candidate[]> {
    const mode = arcModeFor(this.cfg.env.ARC_ENVIRONMENT)
    const rows = await this.prisma.db.$queryRaw<VolumeRow[]>`
      SELECT m.id,
             m.email,
             m."businessName",
             m."onchainMerchantId",
             m.tier::text AS tier,
             t.currency::text AS currency,
             sum(t.amount::numeric)::text AS volume
        FROM "Merchant" m
        JOIN "Transaction" t ON t."merchantId" = m.id
       WHERE m."onchainMerchantId" IS NOT NULL
         AND m.tier <> 'enterprise'::"MerchantTier"
         AND t.status = 'confirmed'::"TransactionStatus"
         AND t.kind <> 'refund'::"TransactionKind"
         AND t.mode = ${mode}::"Mode"
       GROUP BY m.id, t.currency
       ORDER BY m.id`

    const byMerchant = new Map<string, Candidate>()
    for (const row of rows) {
      const candidate = byMerchant.get(row.id) ?? {
        id: row.id,
        email: row.email,
        businessName: row.businessName,
        onchainMerchantId: BigInt(row.onchainMerchantId),
        tier: row.tier,
        volumes: { USDC: 0n, EURC: 0n },
      }
      candidate.volumes[row.currency] = BigInt(row.volume)
      byMerchant.set(row.id, candidate)
    }
    return [...byMerchant.values()]
  }

  private async upgrade(candidate: Candidate, next: VolumePlan): Promise<Upgrade | null> {
    const feeBps = planFeeBps(next)
    if (feeBps === null) throw new Error(`the ${next} plan has no fixed fee`)

    const registryFeeBps = await this.chain.readMerchantFeeBps(candidate.onchainMerchantId)
    const txHash =
      registryFeeBps === feeBps
        ? null
        : await this.chain.setMerchantFeeBps(candidate.onchainMerchantId, feeBps)

    const moved = await this.prisma.db.$transaction(async (tx) => {
      const { count } = await tx.merchant.updateMany({
        where: { id: candidate.id, tier: candidate.tier },
        data: { tier: next },
      })
      if (count === 0) return false
      await tx.auditLog.create({
        data: {
          merchantId: candidate.id,
          category: 'merchant',
          action: 'merchant.plan_upgraded',
          targetType: 'Merchant',
          targetId: candidate.id,
          metadata: {
            previous: candidate.tier,
            next,
            feeBps,
            txHash,
            volumes: volumesForAudit(candidate.volumes),
          },
        },
      })
      return true
    })
    if (!moved) {
      this.log.warn(`merchant ${candidate.id} left ${candidate.tier} before the upgrade landed`)
      return null
    }
    return { candidate, next, feeBps, txHash }
  }

  private async notify({ candidate, next, feeBps, txHash }: Upgrade): Promise<boolean> {
    const plan = PLANS[next]
    const unlocked = (Object.keys(FEATURE_NAMES) as PlanFeature[])
      .filter((feature) => planIncludes(next, feature) && !planIncludes(candidate.tier, feature))
      .map((feature) => FEATURE_NAMES[feature])
    if (plan.prioritySupport && !PLANS[candidate.tier].prioritySupport) {
      unlocked.push('Priority email support')
    }
    const explorer = getArcExplorerUrl(this.cfg.env.ARC_ENVIRONMENT)
    const feeDisplay = `${feeBps / 100}%`
    try {
      const html = await renderToHtml(
        PlanUpgradedEmail({
          merchantBusinessName: candidate.businessName,
          planName: plan.name,
          feeDisplay,
          thresholdDisplay: thresholdDisplay(next, candidate.volumes),
          unlockedFeatures: unlocked,
          explorerTxUrl: txHash ? `${explorer}/tx/${txHash}` : null,
          dashboardUrl: `${process.env.STRIMZ_DASHBOARD_URL ?? STRIMZ_ORIGIN}/app/settings`,
        }),
      )
      await this.email.send({
        to: candidate.email,
        subject: `You've moved to ${plan.name}: ${feeDisplay} per transaction`,
        html,
      })
      return true
    } catch (err) {
      this.log.error(
        `merchant ${candidate.id} moved to ${next} but the email failed: ${(err as Error).message}`,
      )
      return false
    }
  }
}

function volumesForAudit(volumes: PaymentVolumes): Record<PaymentToken, string> {
  return { USDC: volumes.USDC.toString(), EURC: volumes.EURC.toString() }
}

function thresholdDisplay(plan: VolumePlan, volumes: PaymentVolumes): string {
  const threshold = PLANS[plan].entersAtVolume
  if (threshold === null) throw new Error(`the ${plan} plan has no volume threshold`)
  const token = PAYMENT_TOKENS.find(
    (t) => volumes[t] >= BigInt(threshold) * 10n ** BigInt(TOKENS[t].decimals),
  )
  if (!token) throw new Error(`no currency reached the ${plan} threshold`)
  return `${threshold.toLocaleString('en-US')} ${token}`
}
