import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { uuid } from '@strimz/shared-crypto'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

const API_VERSION = '2026-04-27'

/**
 * Flips unpaid sessions past their expiry to `expired` and writes a
 * `payment.failed` outbox event. Only `created`/`awaiting_payment`
 * expire — a `submitted` session already has a broadcast tx and may
 * still confirm.
 */
@Injectable()
export class SessionExpiryService {
  private readonly log = new Logger(SessionExpiryService.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.SESSION_EXPIRY_CRON || '*/60 * * * * *', { name: 'session-expiry' })
  async sweep(): Promise<{ expired: number }> {
    return this.sweepNow()
  }

  async sweepNow(): Promise<{ expired: number }> {
    const expired = (await this.prisma.db.$queryRawUnsafe(`
      WITH due AS (
        SELECT id, "merchantId", mode
          FROM "PaymentSession"
         WHERE status IN ('created'::"PaymentSessionStatus", 'awaiting_payment'::"PaymentSessionStatus")
           AND "expiresAt" < NOW()
      )
      UPDATE "PaymentSession"
         SET status = 'expired'::"PaymentSessionStatus",
             "updatedAt" = NOW()
        FROM due
       WHERE "PaymentSession".id = due.id
       RETURNING "PaymentSession".id,
                 "PaymentSession"."merchantId",
                 "PaymentSession".mode::text AS mode
    `)) as Array<{ id: string; merchantId: string; mode: string }>

    for (const s of expired) {
      await this.prisma.db.webhookEvent.create({
        data: {
          id: `evt_${uuid()}`,
          merchantId: s.merchantId,
          type: 'payment_failed',
          apiVersion: API_VERSION,
          mode: s.mode as 'test' | 'live',
          payload: {
            ref: { kind: 'payment.failed', sessionId: s.id, reason: 'session expired' },
          } as never,
        },
      })
    }

    if (expired.length > 0) this.log.log(`expired ${expired.length} sessions`)
    return { expired: expired.length }
  }
}
