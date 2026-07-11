import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { uuid } from '@strimz/shared-crypto'

const API_VERSION = '2026-04-27'

/**
 * Hourly cron: flips `sent` invoices past their due date to `overdue`
 * and writes an outbox event per row. Only `sent` invoices flip — a
 * `draft` was never delivered to anyone. The dispatcher creates the
 * webhook deliveries.
 */
@Injectable()
export class InvoiceOverdueService {
  private readonly log = new Logger(InvoiceOverdueService.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.INVOICE_OVERDUE_CRON || '0 0 * * * *', { name: 'invoice-overdue' })
  async sweep(): Promise<{ flipped: number }> {
    return this.sweepNow()
  }

  async sweepNow(): Promise<{ flipped: number }> {
    // Atomic flip + return the rows, so two ticks never double-process.
    const flipped = (await this.prisma.db.$queryRawUnsafe(`
      WITH due AS (
        SELECT id, "merchantId", mode
          FROM "Invoice"
         WHERE status = 'sent'::"InvoiceStatus" AND "dueAt" < NOW()
      )
      UPDATE "Invoice"
         SET status = 'overdue'::"InvoiceStatus",
             "updatedAt" = NOW()
        FROM due
       WHERE "Invoice".id = due.id
       RETURNING "Invoice".id,
                 "Invoice"."merchantId",
                 "Invoice".mode::text AS mode
    `)) as Array<{ id: string; merchantId: string; mode: string }>

    for (const inv of flipped) {
      await this.prisma.db.webhookEvent.create({
        data: {
          id: `evt_${uuid()}`,
          merchantId: inv.merchantId,
          type: 'invoice_overdue',
          apiVersion: API_VERSION,
          mode: inv.mode as 'test' | 'live',
          payload: { ref: { kind: 'invoice.overdue', invoiceId: inv.id } } as never,
        },
      })
    }

    if (flipped.length > 0) this.log.log(`flipped ${flipped.length} invoices to overdue`)
    return { flipped: flipped.length }
  }
}
