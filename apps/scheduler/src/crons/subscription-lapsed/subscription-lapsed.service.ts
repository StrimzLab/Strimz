import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { uuid } from '@strimz/shared-crypto'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

const API_VERSION = '2026-04-27'

/**
 * Daily cron: transitions `Subscription.status` from `at_risk` to
 * `lapsed` once the merchant-configured grace window has elapsed.
 *
 *   lapsed when: status='at_risk' AND
 *                currentPeriodEndAt + gracePeriodHours hours < now
 *
 * On transition, fires the `subscription.lapsed` webhook so the
 * merchant's downstream (CRM, dunning tooling) can react.
 *
 * The on-chain subscription stays as-is; the merchant decides whether
 * to call the contract's cancel via the dashboard. Off-chain `lapsed`
 * is informational — it's the marker that says "we tried, the customer
 * didn't pay within grace, stop charging."
 */
@Injectable()
export class SubscriptionLapsedService {
  private readonly log = new Logger(SubscriptionLapsedService.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.SUBSCRIPTION_LAPSED_CRON || '0 0 * * * *', {
    name: 'subscription-lapsed',
  })
  async sweep(): Promise<{ flipped: number }> {
    return this.sweepNow()
  }

  async sweepNow(): Promise<{ flipped: number }> {
    // Flip at_risk subs past their grace window and write one outbox
    // event per row in the same statement. The outbox dispatcher creates
    // the deliveries.
    const flipped = (await this.prisma.db.$queryRawUnsafe(`
      WITH due AS (
        SELECT id, "merchantId", mode
          FROM "Subscription"
         WHERE status = 'at_risk'::"SubscriptionStatus"
           AND "currentPeriodEndAt" + ("gracePeriodHours" || ' hours')::interval < NOW()
      )
      UPDATE "Subscription"
         SET status = 'lapsed'::"SubscriptionStatus",
             "updatedAt" = NOW()
        FROM due
       WHERE "Subscription".id = due.id
       RETURNING "Subscription".id,
                 "Subscription"."merchantId",
                 "Subscription".mode::text AS mode
    `)) as Array<{ id: string; merchantId: string; mode: string }>

    for (const sub of flipped) {
      await this.prisma.db.webhookEvent.create({
        data: {
          id: `evt_${uuid()}`,
          merchantId: sub.merchantId,
          type: 'subscription_lapsed',
          apiVersion: API_VERSION,
          mode: sub.mode as 'test' | 'live',
          payload: { ref: { kind: 'subscription.lapsed', subscriptionId: sub.id } } as never,
        },
      })
    }

    if (flipped.length > 0) this.log.log(`flipped ${flipped.length} subscriptions to lapsed`)
    return { flipped: flipped.length }
  }
}
