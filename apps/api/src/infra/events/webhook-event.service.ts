import { Injectable, Logger } from '@nestjs/common'
import { uuid } from '@strimz/shared-crypto'
import type { WebhookEventName } from '@strimz/shared-types'
import { PrismaService } from '../prisma/prisma.service.js'
import { QueueService, QUEUE_NAMES } from '../queue/queue.service.js'

const API_VERSION = '2026-04-27'

interface EndpointRow {
  id: string
  url: string
  signingSecretHash: string
}

/**
 * Single entry point for "this thing happened in our system" events.
 *
 *   await events.fire({ merchantId, mode, name: 'payment.completed', data: ... })
 *
 * Persists a `WebhookEvent` row, then for every active `MerchantWebhookEndpoint`
 * subscribed to the event name creates one `WebhookDelivery` row in `pending`
 * state and enqueues a delivery job onto the BullMQ `strimz.webhook.delivery`
 * queue. The scheduler app consumes the queue and POSTs to the merchant's URL
 * with HMAC-SHA256 signing.
 *
 * Designed for at-least-once delivery — receivers MUST be idempotent on the
 * `X-Strimz-Delivery-Id` header.
 */
@Injectable()
export class WebhookEventService {
  private readonly log = new Logger(WebhookEventService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async fire<TName extends WebhookEventName>(input: {
    merchantId: string
    mode: 'test' | 'live'
    name: TName
    data: unknown
  }): Promise<{ eventId: string; deliveriesCreated: number }> {
    const eventId = `evt_${uuid()}`
    const envelope = {
      id: eventId,
      type: input.name,
      apiVersion: API_VERSION,
      mode: input.mode,
      createdAt: new Date().toISOString(),
      data: input.data,
    }

    const event = await this.prisma.db.webhookEvent.create({
      data: {
        id: eventId,
        merchantId: input.merchantId,
        type: prismaEventName(input.name),
        apiVersion: API_VERSION,
        mode: input.mode,
        payload: envelope as never,
      },
    })

    const endpoints = (await this.prisma.db.merchantWebhookEndpoint.findMany({
      where: {
        merchantId: input.merchantId,
        mode: input.mode,
        status: 'active',
        events: { has: prismaEventName(input.name) },
      },
      select: { id: true, url: true, signingSecretHash: true },
    })) as EndpointRow[]

    if (endpoints.length === 0) {
      this.log.debug(`event ${eventId} (${input.name}) — no active endpoints`)
      return { eventId: event.id, deliveriesCreated: 0 }
    }

    // Materialise one Delivery row per (event × endpoint) so the scheduler
    // can drive each one independently with its own retry schedule.
    const deliveryIds = endpoints.map(() => `whdl_${uuid()}`)
    await this.prisma.db.webhookDelivery.createMany({
      data: endpoints.map((endpoint, i) => ({
        id: deliveryIds[i] as string,
        deliveryId: deliveryIds[i] as string,
        merchantId: input.merchantId,
        endpointId: endpoint.id,
        eventId: event.id,
        eventName: prismaEventName(input.name),
        status: 'pending' as const,
        attempt: 1,
      })),
    })

    const deliveryQ = this.queue.queue(QUEUE_NAMES.webhookDelivery)
    await Promise.all(
      endpoints.map((endpoint, i) =>
        deliveryQ.add(
          'deliver',
          {
            deliveryId: deliveryIds[i],
            endpointId: endpoint.id,
            url: endpoint.url,
            signingSecretHash: endpoint.signingSecretHash,
            eventId: event.id,
          },
          {
            attempts: 1, // Outer scheduler handles retries via its own state machine.
            removeOnComplete: 1_000,
            removeOnFail: 1_000,
          },
        ),
      ),
    )

    this.log.log(`fired ${input.name} event=${eventId} deliveries=${endpoints.length}`)
    return { eventId: event.id, deliveriesCreated: endpoints.length }
  }
}

/**
 * Convert a wire-format event name (`payment.completed`) to the Prisma enum
 * value (`payment_completed`). Prisma enum values disallow `.`.
 */
function prismaEventName(name: string): never {
  return name.replace(/\./g, '_') as never
}
