import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { ActivityLogService } from '../../infra/activity-log/activity-log.service.js'
import { escapeHtml } from '../../common/escape-html.js'
import { formatAmount } from '../../common/money/currency-amounts.js'

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
      const { balanceCents, eurcBalance } = await this.estimateLiquidReserveCents(cfg.merchantId)
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
            eurcBalance,
          }),
        })
      } catch (err) {
        this.log.warn(
          `yield email failed for merchant=${cfg.merchantId}: ${(err as Error).message}`,
        )
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
          eurcBalance: eurcBalance.toString(),
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
  private async estimateLiquidReserveCents(
    merchantId: string,
  ): Promise<{ balanceCents: number; eurcBalance: bigint }> {
    type Row = { currency: string; net: string; refunded: string }
    const rows = (await this.prisma.db.$queryRawUnsafe(
      `SELECT c.currency::text AS currency,
              COALESCE((SELECT sum(("netAmount")::numeric) FROM "Transaction"
                         WHERE "merchantId" = $1
                           AND currency = c.currency
                           AND mode = 'live'::"Mode"
                           AND status = 'confirmed'::"TransactionStatus"
                           AND kind != 'refund'::"TransactionKind"), 0)::text AS net,
              COALESCE((SELECT sum(("amount")::numeric) FROM "Refund"
                         WHERE "merchantId" = $1
                           AND currency = c.currency
                           AND mode = 'live'::"Mode"
                           AND status = 'completed'::"RefundStatus"), 0)::text AS refunded
         FROM unnest(enum_range(NULL::"PaymentCurrency")) AS c(currency)`,
      merchantId,
    )) as Row[]
    const balance = (currency: 'USDC' | 'EURC'): bigint => {
      const row = rows.find((r) => r.currency === currency)
      if (!row) {
        throw new Error(
          `yield balance query returned no ${currency} row for merchant=${merchantId}`,
        )
      }
      const micros = BigInt(row.net) - BigInt(row.refunded)
      return micros > 0n ? micros : 0n
    }
    return { balanceCents: Number(balance('USDC') / 10_000n), eurcBalance: balance('EURC') }
  }
}

function renderYieldEmail(input: {
  merchantName: string
  surplusCents: number
  reserveCents: number
  eurcBalance: bigint
}): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:auto;color:#1a1a1a;">
      <h2 style="color:#02C76A;margin:0 0 16px;">Cash surplus available</h2>
      <p>${escapeHtml(input.merchantName)} — your operating balance is currently above your configured liquid reserve.</p>
      <p><strong>Surplus:</strong> $${(input.surplusCents / 100).toFixed(2)}<br/>
         <strong>Reserve target:</strong> $${(input.reserveCents / 100).toFixed(2)}</p>
      <p><strong>EURC balance:</strong> ${formatAmount(input.eurcBalance, 'EURC')} (not counted towards the reserve)</p>
      <p>Consider moving the surplus into a yield position. We'll wire the deposit transaction once you confirm in the dashboard.</p>
    </div>
  `
}
