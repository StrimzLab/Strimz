import { Logger } from '@nestjs/common'
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import type { Job, Queue } from 'bullmq'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { WebhookSigningService } from '../../infra/webhook-signing/signing.service.js'
import { WebhookSecretCache } from '../../infra/webhook-signing/secret-cache.service.js'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import {
  webhookDeliveryJobSchema,
  type WebhookDeliveryJob,
} from '../../infra/queue/job-payloads.js'

const RETRY_BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000] // 1m, 5m, 30m, 2h, 12h

/**
 * Consumes `strimz.webhook.delivery`.
 *
 * Per job:
 *   1. Load the WebhookEvent envelope (canonical body) and the Endpoint
 *      record (URL, current state).
 *   2. Resolve the plaintext signing secret from the Redis-backed cache.
 *      If missing, fail the job permanently — we can't sign without it.
 *   3. POST the envelope JSON to the endpoint URL with HMAC-SHA256 signing
 *      (`Strimz-Signature: t=<unix>,v1=<hex>`) and a configurable timeout.
 *   4. On 2xx → mark `delivered`, bump endpoint `lastDeliveredAt`.
 *   5. On 4xx / 5xx / network error → bump `attempt`, schedule the next
 *      retry (RETRY_BACKOFF_MS) up to `WEBHOOK_MAX_ATTEMPTS`.
 *   6. After max attempts → mark `permanently_failed`, append AuditLog,
 *      and (M2) email the merchant.
 *
 * BullMQ's native retry isn't used because we want explicit per-attempt
 * persistence in the DB so the dashboard can render every attempt's
 * response code / timing / body. Instead we control the retry schedule by
 * re-enqueuing with `delay`.
 */
@Processor(QUEUE_NAMES.webhookDelivery)
export class WebhookDeliveryWorker extends WorkerHost {
  private readonly log = new Logger(WebhookDeliveryWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly signing: WebhookSigningService,
    private readonly secrets: WebhookSecretCache,
    private readonly cfg: TypedConfigService,
    @InjectQueue(QUEUE_NAMES.webhookDelivery)
    private readonly retryQueue: Queue<WebhookDeliveryJob>,
  ) {
    super()
  }

  async process(job: Job<WebhookDeliveryJob>): Promise<{ status: string; httpStatus?: number }> {
    const data = webhookDeliveryJobSchema.parse(job.data)

    const [delivery, endpoint, event] = await Promise.all([
      this.prisma.db.webhookDelivery.findUniqueOrThrow({ where: { id: data.deliveryId } }),
      this.prisma.db.merchantWebhookEndpoint.findUniqueOrThrow({ where: { id: data.endpointId } }),
      this.prisma.db.webhookEvent.findUniqueOrThrow({ where: { id: data.eventId } }),
    ])

    if (delivery.status === 'delivered' || delivery.status === 'permanently_failed') {
      // Already terminal — replays of an old job no-op.
      return { status: delivery.status }
    }

    const secret = await this.secrets.get(endpoint.id)
    if (!secret) {
      await this.markPermanentlyFailed(delivery.id, 0, 'signing secret not in cache')
      return { status: 'permanently_failed' }
    }

    const body = JSON.stringify(event.payload)
    const signature = await this.signing.buildSignatureHeader(secret, body)

    const start = Date.now()
    let httpStatus = 0
    let responseBody = ''
    let networkError: string | null = null
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.cfg.env.WEBHOOK_DELIVERY_TIMEOUT_MS)
      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Strimz/1.0',
            'Strimz-Signature': signature,
            'Strimz-Event-Id': event.id,
            'Strimz-Event-Type': String(event.type).replace(/_/g, '.'),
            'X-Strimz-Delivery-Id': delivery.deliveryId,
          },
          body,
          signal: controller.signal,
        })
        httpStatus = res.status
        responseBody = (await res.text()).slice(0, 4_000)
      } finally {
        clearTimeout(timeout)
      }
    } catch (err) {
      networkError = (err as Error).message
    }
    const responseMs = Date.now() - start
    const nextAttempt = delivery.attempt + 1

    // 2xx → success.
    if (httpStatus >= 200 && httpStatus < 300) {
      await this.prisma.db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'delivered',
          attempt: nextAttempt,
          responseCode: httpStatus,
          responseMs,
          deliveredAt: new Date(),
          nextAttemptAt: null,
        },
      })
      await this.prisma.db.merchantWebhookEndpoint.update({
        where: { id: endpoint.id },
        data: { lastDeliveredAt: new Date() },
      })
      return { status: 'delivered', httpStatus }
    }

    // Failed attempt — decide retry vs permanent.
    const lastError = networkError ?? `${httpStatus}: ${responseBody.slice(0, 500)}`
    if (nextAttempt >= this.cfg.env.WEBHOOK_MAX_ATTEMPTS) {
      await this.markPermanentlyFailed(delivery.id, httpStatus, lastError)
      this.log.warn(`delivery ${delivery.id} permanently failed after ${nextAttempt} attempts`)
      return { status: 'permanently_failed', httpStatus }
    }

    const backoff = RETRY_BACKOFF_MS[delivery.attempt] ?? RETRY_BACKOFF_MS.at(-1)!
    const nextAttemptAt = new Date(Date.now() + backoff)
    await this.prisma.db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'retrying',
        attempt: nextAttempt,
        responseCode: httpStatus || null,
        responseMs,
        responseBody: responseBody || null,
        lastError,
        nextAttemptAt,
      },
    })
    // Re-enqueue with delay — keeps each attempt as a discrete BullMQ job
    // for observability.
    await this.retryQueue.add(
      'deliver',
      data,
      { delay: backoff, removeOnComplete: 1_000, removeOnFail: 1_000 },
    )
    return { status: 'retrying', httpStatus }
  }

  private async markPermanentlyFailed(
    deliveryId: string,
    httpStatus: number,
    lastError: string,
  ): Promise<void> {
    await this.prisma.db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'permanently_failed',
        responseCode: httpStatus || null,
        lastError,
        nextAttemptAt: null,
      },
    })
  }
}
