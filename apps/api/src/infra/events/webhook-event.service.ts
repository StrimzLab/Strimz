import { Injectable, Logger } from '@nestjs/common'
import { uuid } from '@strimz/shared-crypto'
import type { WebhookEventName } from '@strimz/shared-types'
import { PrismaService } from '../prisma/prisma.service.js'

const API_VERSION = '2026-04-27'

/**
 * Writes a "this happened" event into the outbox. The scheduler's
 * WebhookOutboxService claims undispatched rows, creates deliveries, and
 * enqueues them — one dispatch path shared with the Go indexer's events.
 *
 * `data` must already be the schema-valid envelope body; the dispatcher
 * validates the full envelope before delivery.
 */
@Injectable()
export class WebhookEventService {
  private readonly log = new Logger(WebhookEventService.name)

  constructor(private readonly prisma: PrismaService) {}

  async fire<TName extends WebhookEventName>(input: {
    merchantId: string
    mode: 'test' | 'live'
    name: TName
    data: unknown
  }): Promise<{ eventId: string }> {
    const eventId = `evt_${uuid()}`
    const event = await this.prisma.db.webhookEvent.create({
      data: {
        id: eventId,
        merchantId: input.merchantId,
        type: prismaEventName(input.name),
        apiVersion: API_VERSION,
        mode: input.mode,
        payload: {
          id: eventId,
          type: input.name,
          apiVersion: API_VERSION,
          mode: input.mode,
          createdAt: new Date().toISOString(),
          data: input.data,
        } as never,
      },
    })
    this.log.debug(`queued ${input.name} event=${eventId} for dispatch`)
    return { eventId: event.id }
  }
}

/** `payment.completed` → `payment_completed` (Prisma enum disallows `.`). */
function prismaEventName(name: string): never {
  return name.replace(/\./g, '_') as never
}
