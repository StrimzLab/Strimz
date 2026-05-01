import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { ActivityLogService } from '../../infra/activity-log/activity-log.service.js'

/**
 * Computes whether a merchant has cumulative net revenue above their
 * configured `cashflowMinimumLiquidReserveCents` threshold and, if
 * `cashflowAutoConvertToYield = true`, emails them a recommendation
 * to move the surplus to yield.
 *
 * The actual yield-deposit transaction is **not** signed here.
 * Strimz's product surface on Arc does not yet include a yield
 * protocol contract; emailing the merchant is the production behaviour
 * until one ships. When it does, the merchant's confirmation flow
 * enqueues a scheduler job that signs the deposit — this service stays
 * responsible only for surfacing the recommendation.
 *
 * This is the standard "AutoPay Agent surfaces, merchant decides"
 * pattern — never autonomous fund movement without explicit consent.
 */
@Injectable()
export class CashflowYieldService {
  private readonly log = new Logger(CashflowYieldService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly activity: ActivityLogService,
  ) {}

  async tick(): Promise<{ recommended: number; skipped: number }> {
    const merchants = await this.prisma.db.agentMerchantConfig.findMany({
      where: {
        enabledCapabilities: { has: 'cashflow' },
        cashflowAutoConvertToYield: true,
      },
      include: { merchant: true },
    })

    let recommended = 0
    let skipped = 0
    for (const cfg of merchants) {
      // Track-record balance: sum of confirmed `Transaction.netAmount` to
      // date, minus refunds. Off-chain projection — the on-chain wallet
      // balance might differ if the merchant has been moving funds out.
      const balanceCents = await this.estimateLiquidReserveCents(cfg.merchantId)
      if (balanceCents <= cfg.cashflowMinimumLiquidReserveCents) {
        skipped++
        continue
      }

      const surplusCents = balanceCents - cfg.cashflowMinimumLiquidReserveCents

      // Dedup: don't email more than once every 24h.
      const recent = await this.prisma.db.agentActivityLog.findFirst({
        where: {
          merchantId: cfg.merchantId,
          capability: 'cashflow',
          actionType: 'cashflow_yield_converted',
          createdAt: { gte: new Date(Date.now() - 23 * 60 * 60 * 1_000) },
        },
        select: { id: true },
      })
      if (recent) {
        skipped++
        continue
      }

      try {
        await this.email.send({
          to: cfg.merchant.email,
          subject: 'Strimz: cash surplus available for yield',
          html: renderYieldEmail({
            merchantName: cfg.merchant.businessName ?? 'merchant',
            surplusCents,
            reserveCents: cfg.cashflowMinimumLiquidReserveCents,
          }),
        })
      } catch (err) {
        this.log.warn(`yield email failed for merchant=${cfg.merchantId}: ${(err as Error).message}`)
      }

      // We log the *recommendation*. The actual `cashflow_yield_converted`
      // event would only land here once the merchant confirms and the
      // scheduler signs the deposit. Until that flow exists we record
      // outcome=`pending` so the dashboard can show "we suggested this".
      await this.activity.record({
        merchantId: cfg.merchantId,
        capability: 'cashflow',
        actionType: 'cashflow_yield_converted',
        outcome: 'pending',
        metadata: {
          surplusCents,
          reserveCents: cfg.cashflowMinimumLiquidReserveCents,
          balanceCents,
          stage: 'recommendation_sent',
        },
      })
      recommended++
    }

    return { recommended, skipped }
  }

  /**
   * Estimates the merchant's running off-chain liquid balance in **USD
   * cents** (assumes USDC ≈ USD). Sums confirmed Transaction.netAmount,
   * subtracts completed refunds. Returns 0 if negative.
   *
   * USDC has 6 decimals; cents = micros / 10_000.
   */
  private async estimateLiquidReserveCents(merchantId: string): Promise<number> {
    type Row = { net: bigint | null; refunded: bigint | null }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT
         COALESCE((SELECT sum(("netAmount")::numeric) FROM "Transaction"
                    WHERE "merchantId" = $1
                      AND status = 'confirmed'::"TransactionStatus"
                      AND kind != 'refund'::"TransactionKind"), 0)::bigint AS net,
         COALESCE((SELECT sum(("amount")::numeric) FROM "Refund"
                    WHERE "merchantId" = $1
                      AND status = 'completed'::"RefundStatus"), 0)::bigint AS refunded`,
      merchantId,
    )) as Row[]
    const r = rows[0] ?? { net: 0n, refunded: 0n }
    const micros = (r.net ?? 0n) - (r.refunded ?? 0n)
    if (micros <= 0n) return 0
    return Number(micros / 10_000n)
  }
}

function renderYieldEmail(input: {
  merchantName: string
  surplusCents: number
  reserveCents: number
}): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#02C76A;margin:0 0 16px;">Cash surplus available</h2>
      <p>${escapeHtml(input.merchantName)} — your operating balance is currently above your configured liquid reserve.</p>
      <p><strong>Surplus:</strong> $${(input.surplusCents / 100).toFixed(2)}<br/>
         <strong>Reserve target:</strong> $${(input.reserveCents / 100).toFixed(2)}</p>
      <p>Consider moving the surplus into a yield position. We'll wire the deposit transaction once you confirm in the dashboard.</p>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
