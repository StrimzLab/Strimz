import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { uuid } from '@strimz/shared-crypto'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'

/**
 * Daily cron that flips invoices past their due date to `overdue` and
 * fires the `invoice.overdue` webhook event for each.
 *
 * The webhook event row + delivery rows are written here directly — same
 * pattern the API uses in `WebhookEventService` — and the delivery jobs
 * land on the standard `strimz.webhook.delivery` queue.
 */
@Injectable()
export class InvoiceOverdueService {
  private readonly log = new Logger(InvoiceOverdueService.name)
  private readonly apiVersion = '2026-04-27'

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.webhookDelivery)
    private readonly deliveryQueue: Queue,
  ) {}

  /** Default cadence: hourly on the hour. Configurable via env. */
  @Cron(process.env.INVOICE_OVERDUE_CRON || '0 0 * * * *', { name: 'invoice-overdue' })
  async sweep(): Promise<{ flipped: number; deliveriesQueued: number }> {
    return this.sweepNow()
  }

  async sweepNow(): Promise<{ flipped: number; deliveriesQueued: number }> {
    const now = new Date()
    const overdue = await this.prisma.db.invoice.findMany({
      where: { status: { in: ['draft', 'sent'] }, dueAt: { lt: now } },
    })
    if (overdue.length === 0) return { flipped: 0, deliveriesQueued: 0 }

    let deliveriesQueued = 0
    for (const inv of overdue) {
      const updated = await this.prisma.db.invoice.update({
        where: { id: inv.id },
        data: { status: 'overdue' },
      })

      const eventId = `evt_${uuid()}`
      const envelope = {
        id: eventId,
        type: 'invoice.overdue',
        apiVersion: this.apiVersion,
        mode: inv.mode,
        createdAt: new Date().toISOString(),
        data: { id: updated.id, number: updated.number, dueAt: updated.dueAt.toISOString() },
      }

      await this.prisma.db.webhookEvent.create({
        data: {
          id: eventId,
          merchantId: inv.merchantId,
          type: 'invoice_overdue',
          apiVersion: this.apiVersion,
          mode: inv.mode,
          payload: envelope as never,
        },
      })

      const endpoints = await this.prisma.db.merchantWebhookEndpoint.findMany({
        where: {
          merchantId: inv.merchantId,
          mode: inv.mode,
          status: 'active',
          events: { has: 'invoice_overdue' },
        },
      })
      for (const ep of endpoints) {
        const deliveryId = `whdl_${uuid()}`
        await this.prisma.db.webhookDelivery.create({
          data: {
            id: deliveryId,
            deliveryId,
            merchantId: inv.merchantId,
            endpointId: ep.id,
            eventId,
            eventName: 'invoice_overdue',
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
      `flipped ${overdue.length} invoices to overdue, queued ${deliveriesQueued} deliveries`,
    )
    return { flipped: overdue.length, deliveriesQueued }
  }
}
