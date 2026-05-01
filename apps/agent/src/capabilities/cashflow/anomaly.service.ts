import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { ActivityLogService } from '../../infra/activity-log/activity-log.service.js'
import { TypedConfigService } from '../../config/index.js'

/**
 * Hourly tick. For each merchant with `cashflow` enabled, computes:
 *
 *   - last_hour_revenue  : sum of confirmed Transaction.amount in the
 *                          last completed clock-hour
 *   - hourly_mean        : mean over the trailing 30 days of the
 *                          *same hour-of-day* (so 9am compared to 9am)
 *   - hourly_stddev      : population stddev over the same window
 *
 * If `last_hour_revenue` deviates by more than `nσ` *below* the mean
 * (where n is `ANOMALY_THRESHOLD_{LOW,MEDIUM,HIGH}` depending on the
 * merchant's `cashflowAnomalySensitivity`), fires an alert email and
 * an `AuditLog` entry.
 *
 * We only flag drops, not surges, because revenue surges aren't
 * actionable for the merchant; sustained drops are.
 */
@Injectable()
export class CashflowAnomalyService {
  private readonly log = new Logger(CashflowAnomalyService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly activity: ActivityLogService,
    private readonly cfg: TypedConfigService,
  ) {}

  async tick(now: Date = new Date()): Promise<{ flagged: number; checked: number }> {
    const hourEnd = utcHourFloor(now)
    const hourStart = new Date(hourEnd.getTime() - 60 * 60 * 1_000)

    const merchants = await this.prisma.db.agentMerchantConfig.findMany({
      where: { enabledCapabilities: { has: 'cashflow' } },
      include: { merchant: true },
    })

    let flagged = 0
    for (const cfg of merchants) {
      const stats = await this.computeStats(cfg.merchantId, hourStart, hourEnd)
      const threshold = this.thresholdFor(cfg.cashflowAnomalySensitivity)

      // Need a baseline to flag. Fewer than 7 prior data points → skip.
      if (stats.priorSamples < 7) {
        continue
      }

      const revenueNum = Number(stats.lastHour) / 1_000_000 // USDC
      const meanNum = stats.mean / 1_000_000
      const sdNum = stats.stddev / 1_000_000

      // z = (x - μ) / σ. Negative z → drop. We only fire on drops, and
      // only when |z| > threshold AND the deviation is below the mean.
      const z = sdNum === 0 ? 0 : (revenueNum - meanNum) / sdNum
      if (z >= -threshold) {
        continue
      }

      try {
        await this.email.send({
          to: cfg.merchant.email,
          subject: `Strimz: revenue anomaly detected (-${(-z).toFixed(1)}σ)`,
          html: renderAnomalyEmail({
            merchantName: cfg.merchant.businessName ?? 'merchant',
            hour: hourStart,
            actualRevenue: stats.lastHour,
            expectedMean: stats.mean,
            stddev: stats.stddev,
            zScore: z,
          }),
        })
      } catch (err) {
        this.log.warn(
          `anomaly email failed for merchant=${cfg.merchantId}: ${(err as Error).message}`,
        )
      }

      await this.activity.record({
        merchantId: cfg.merchantId,
        capability: 'cashflow',
        actionType: 'cashflow_anomaly_flagged',
        outcome: 'success',
        metadata: {
          hour: hourStart.toISOString(),
          actualRevenue: stats.lastHour.toString(),
          expectedMean: Math.round(stats.mean).toString(),
          stddev: Math.round(stats.stddev).toString(),
          zScore: Number(z.toFixed(2)),
          sensitivity: cfg.cashflowAnomalySensitivity,
        },
      })
      // AuditLog gives the dashboard a flat stream regardless of
      // capability — same pattern the indexer uses for FeeAccrued.
      await this.prisma.db.auditLog.create({
        data: {
          merchantId: cfg.merchantId,
          category: 'agent',
          action: 'cashflow.anomaly_detected',
          targetType: 'Merchant',
          targetId: cfg.merchantId,
          metadata: {
            zScore: Number(z.toFixed(2)),
            sensitivity: cfg.cashflowAnomalySensitivity,
            hour: hourStart.toISOString(),
          } as never,
        },
      })
      flagged++
    }

    return { flagged, checked: merchants.length }
  }

  private thresholdFor(sensitivity: string): number {
    switch (sensitivity) {
      case 'low':
        return this.cfg.env.ANOMALY_THRESHOLD_LOW
      case 'high':
        return this.cfg.env.ANOMALY_THRESHOLD_HIGH
      case 'medium':
      default:
        return this.cfg.env.ANOMALY_THRESHOLD_MEDIUM
    }
  }

  private async computeStats(
    merchantId: string,
    hourStart: Date,
    hourEnd: Date,
  ): Promise<{
    lastHour: bigint
    mean: number
    stddev: number
    priorSamples: number
  }> {
    type Row = { lastHour: bigint | null; priorMean: number | null; priorStddev: number | null; samples: bigint }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `WITH hourly AS (
         SELECT
           date_trunc('hour', "blockTimestamp") AS hr,
           sum(("amount")::numeric) AS rev
         FROM "Transaction"
         WHERE "merchantId" = $1
           AND status = 'confirmed'::"TransactionStatus"
           AND "blockTimestamp" >= $2
           AND "blockTimestamp" < $3
         GROUP BY hr
       ),
       last_hour AS (
         SELECT COALESCE(sum(("amount")::numeric), 0)::bigint AS rev
         FROM "Transaction"
         WHERE "merchantId" = $1
           AND status = 'confirmed'::"TransactionStatus"
           AND "blockTimestamp" >= $4
           AND "blockTimestamp" < $5
       )
       SELECT
         (SELECT rev FROM last_hour) AS "lastHour",
         (SELECT avg(rev)::float8     FROM hourly WHERE EXTRACT(HOUR FROM hr) = $6) AS "priorMean",
         (SELECT stddev_pop(rev)::float8 FROM hourly WHERE EXTRACT(HOUR FROM hr) = $6) AS "priorStddev",
         (SELECT count(*)::bigint     FROM hourly WHERE EXTRACT(HOUR FROM hr) = $6) AS samples
       `,
      merchantId,
      new Date(hourEnd.getTime() - 30 * 24 * 60 * 60 * 1_000),
      hourEnd,
      hourStart,
      hourEnd,
      hourStart.getUTCHours(),
    )) as Row[]
    const r = rows[0] ?? { lastHour: 0n, priorMean: 0, priorStddev: 0, samples: 0n }
    return {
      lastHour: r.lastHour ?? 0n,
      mean: r.priorMean ?? 0,
      stddev: r.priorStddev ?? 0,
      priorSamples: Number(r.samples),
    }
  }
}

function utcHourFloor(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()),
  )
}

function renderAnomalyEmail(input: {
  merchantName: string
  hour: Date
  actualRevenue: bigint
  expectedMean: number
  stddev: number
  zScore: number
}): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#c92a2a;margin:0 0 16px;">Revenue anomaly detected</h2>
      <p>${escapeHtml(input.merchantName)} — your revenue for the hour starting ${input.hour.toISOString()} is significantly below your typical pattern.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Actual</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${humanise(input.actualRevenue)} USDC</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Typical (30-day mean)</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${(input.expectedMean / 1_000_000).toFixed(2)} USDC</td></tr>
        <tr><td style="padding:8px;">Deviation</td><td style="padding:8px;text-align:right;">${input.zScore.toFixed(2)}σ</td></tr>
      </table>
    </div>
  `
}

function humanise(raw: bigint): string {
  const whole = raw / 1_000_000n
  const frac = (raw % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return frac.length === 0 ? whole.toString() : `${whole}.${frac}`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
