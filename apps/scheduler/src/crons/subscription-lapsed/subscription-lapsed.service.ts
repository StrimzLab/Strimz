import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { uuid } from '@strimz/shared-crypto'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'

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

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.webhookDelivery)
    private readonly deliveryQueue: Queue,
  ) {}

  @Cron(process.env.SUBSCRIPTION_LAPSED_CRON || '0 0 * * * *', {
    name: 'subscription-lapsed',
  })
  async sweep(): Promise<{ flipped: number; deliveriesQueued: number }> {
    return this.sweepNow()
  }

  async sweepNow(): Promise<{ flipped: number; deliveriesQueued: number }> {
    // Postgres CTE: find at_risk subs whose grace window has passed,
    // flip them in one round-trip, RETURNING the rows so we can fire
    // webhooks per row.
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

    if (flipped.length === 0) {
      return { flipped: 0, deliveriesQueued: 0 }
    }

    let deliveriesQueued = 0
    for (const sub of flipped) {
      const eventId = `evt_${uuid()}`
      await this.prisma.db.webhookEvent.create({
        data: {
          id: eventId,
          merchantId: sub.merchantId,
          type: 'subscription_lapsed',
          apiVersion: API_VERSION,
          mode: sub.mode as 'test' | 'live',
          payload: {
            id: eventId,
            type: 'subscription.lapsed',
            apiVersion: API_VERSION,
            mode: sub.mode,
            createdAt: new Date().toISOString(),
            data: { id: sub.id },
          } as never,
        },
      })

      const endpoints = await this.prisma.db.merchantWebhookEndpoint.findMany({
        where: {
          merchantId: sub.merchantId,
          mode: sub.mode as 'test' | 'live',
          status: 'active',
          events: { has: 'subscription_lapsed' },
        },
      })
      for (const ep of endpoints) {
        const deliveryId = `whdl_${uuid()}`
        await this.prisma.db.webhookDelivery.create({
          data: {
            id: deliveryId,
            deliveryId,
            merchantId: sub.merchantId,
            endpointId: ep.id,
            eventId,
            eventName: 'subscription_lapsed',
            status: 'pending',
            attempt: 1,
          },
        })
        await this.deliveryQueue.add(
          'deliver',
          {
            deliveryId,
            endpointId: ep.id,
            url: ep.url,
            signingSecretHash: ep.signingSecretHash,
            eventId,
          },
          { removeOnComplete: 1_000, removeOnFail: 1_000 },
        )
        deliveriesQueued++
      }
    }

    this.log.log(
      `flipped ${flipped.length} subscriptions to lapsed, queued ${deliveriesQueued} deliveries`,
    )
    return { flipped: flipped.length, deliveriesQueued }
  }
}
