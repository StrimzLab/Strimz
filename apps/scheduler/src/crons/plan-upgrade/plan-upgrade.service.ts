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

import { pooledVolumes } from '@strimz/db'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

const FEATURE_NAMES: Record<PlanFeature, string> = {
  storefront: 'Storefront builder',
  anomaly_alerts: 'Anomaly alerts',
  yield_recommendations: 'Yield recommendations',
}

interface Candidate {
  id: string
  email: string
  businessName: string | null
  onchainMerchantId: bigint
  tier: MerchantTier
  /** Pooled with linked accounts (shared payout address or owner wallet). */
  volumes: Record<PaymentToken, bigint>
  ownVolumes: Record<PaymentToken, bigint>
  linkedMerchantIds: string[]
}

interface Upgrade {
  candidate: Candidate
  next: VolumePlan
  feeBps: number
  txHash: `0x${string}` | null
}

export interface PlanUpgradeResult {
  checked: number
  scheduled: number
  upgraded: number
  failed: number
  emailFailed: number
}

type FeeStep = { kind: 'live'; txHash: `0x${string}` | null } | { kind: 'scheduled' | 'waiting' }

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
    const result: PlanUpgradeResult = {
      checked: 0,
      scheduled: 0,
      upgraded: 0,
      failed: 0,
      emailFailed: 0,
    }
    if (this.running) return result
    this.running = true
    try {
      for (const candidate of await this.candidates()) {
        await this.process(candidate, result)
      }
    } finally {
      this.running = false
    }
    if (result.checked > 0) {
      this.log.log(
        `plan-upgrade: scheduled=${result.scheduled} upgraded=${result.upgraded} failed=${result.failed} emailFailed=${result.emailFailed}`,
      )
    }
    return result
  }

  private async process(candidate: Candidate, result: PlanUpgradeResult): Promise<void> {
    const next = planUpgradeFor(candidate.tier, candidate.volumes)
    if (!next) return
    result.checked++
    let upgrade: Upgrade | 'scheduled' | 'waiting' | null
    try {
      upgrade = await this.upgrade(candidate, next)
    } catch (err) {
      result.failed++
      this.log.error(
        `plan upgrade ${candidate.tier} -> ${next} failed for merchant ${candidate.id}: ${(err as Error).message}`,
      )
      return
    }
    if (upgrade === 'scheduled') result.scheduled++
    if (!upgrade || upgrade === 'scheduled' || upgrade === 'waiting') return
    result.upgraded++
    if (!(await this.notify(upgrade))) result.emailFailed++
    if (planUpgradeFor(candidate.tier, candidate.ownVolumes) !== next) {
      await this.alertLinked(candidate, next)
    }
  }

  private async candidates(merchantId?: string): Promise<Candidate[]> {
    const mode = arcModeFor(this.cfg.env.ARC_ENVIRONMENT)
    const rows = await pooledVolumes(this.prisma.db, { mode, merchantId })

    const byMerchant = new Map<string, Candidate>()
    for (const row of rows) {
      const candidate = byMerchant.get(row.id) ?? {
        id: row.id,
        email: row.email,
        businessName: row.businessName,
        onchainMerchantId: BigInt(row.onchainMerchantId),
        tier: row.tier as MerchantTier,
        volumes: { USDC: 0n, EURC: 0n },
        ownVolumes: { USDC: 0n, EURC: 0n },
        linkedMerchantIds: [],
      }
      candidate.volumes[row.currency] = BigInt(row.volume)
      candidate.ownVolumes[row.currency] = BigInt(row.ownVolume)
      for (const id of row.contributors) {
        if (id !== row.id && !candidate.linkedMerchantIds.includes(id)) {
          candidate.linkedMerchantIds.push(id)
        }
      }
      byMerchant.set(row.id, candidate)
    }
    return [...byMerchant.values()]
  }

  private async alertLinked(candidate: Candidate, next: VolumePlan): Promise<void> {
    const ids = [candidate.id, ...candidate.linkedMerchantIds]
    try {
      await this.email.send({
        to: this.cfg.env.STRIMZ_ADMIN_ALERT_EMAIL,
        subject: `Linked accounts: merchant ${candidate.id} moved to ${PLANS[next].name} on pooled volume`,
        html: `<p>Merchant <code>${candidate.id}</code> left the free allowance because accounts sharing its payout address or owner wallet reached the threshold together.</p><p>Linked merchants: ${ids.map((id) => `<code>${id}</code>`).join(', ')}</p>`,
      })
    } catch (err) {
      this.log.error(`linked-accounts alert for ${candidate.id} failed: ${(err as Error).message}`)
    }
  }

  private async upgrade(
    candidate: Candidate,
    next: VolumePlan,
  ): Promise<Upgrade | 'scheduled' | 'waiting' | null> {
    const feeBps = planFeeBps(next)
    if (feeBps === null) throw new Error(`the ${next} plan has no fixed fee`)

    const step = await this.applyFee(candidate.onchainMerchantId, feeBps)
    if (step.kind !== 'live') return step.kind
    const txHash = step.txHash

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

  // The plan moves only once the registry charges its fee. A decrease applies
  // at once; an increase from the scheduler key is scheduled, then committed
  // on a later tick after FEE_INCREASE_DELAY.
  private async applyFee(merchantId: bigint, feeBps: number): Promise<FeeStep> {
    const current = await this.chain.readMerchantFeeBps(merchantId)
    if (current === feeBps) return { kind: 'live', txHash: null }
    if (feeBps < current) {
      return { kind: 'live', txHash: await this.chain.setMerchantFeeBps(merchantId, feeBps) }
    }
    const pending = await this.chain.readPendingFee(merchantId)
    if (pending.effectiveAt === 0n || pending.feeBps !== feeBps) {
      await this.chain.setMerchantFeeBps(merchantId, feeBps)
      return { kind: 'scheduled' }
    }
    if ((await this.chain.latestBlockTimestamp()) < pending.effectiveAt) return { kind: 'waiting' }
    return { kind: 'live', txHash: await this.chain.commitMerchantFeeBps(merchantId) }
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
