import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { encryptAesGcm, randomBase64Url, sha256Hex } from '@strimz/shared-crypto'
import type {
  CreateWebhookEndpointInput,
  CreateWebhookEndpointOutput,
  WebhookEndpoint,
  WebhookDelivery,
} from '@strimz/shared-types'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { QueueService, QUEUE_NAMES } from '../../infra/queue/queue.service.js'
import { RedisService } from '../../infra/redis/redis.service.js'
import { isPrivateOrLoopback } from './ssrf-guard.js'

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

/**
 * Cache key under which the plaintext signing secret is stored for the
 * scheduler's webhook worker. Must match `WebhookSecretCache` in
 * `apps/scheduler/src/infra/webhook-signing/secret-cache.service.ts`
 * exactly — the two apps share Redis but not code.
 *
 * Redis is the v1 home for plaintext secrets because (a) the scheduler
 * needs them on the hot delivery path and (b) Postgres dumps are the
 * single most common sensitive-data exfiltration vector. The trade-off
 * is durability: a Redis flush wipes secrets and breaks every endpoint
 * until rotation. The follow-up task `#71` graduates this to
 * encrypted-at-rest in Postgres with Redis as a hot cache.
 */
const SECRET_CACHE_KEY = (endpointId: string): string => `webhook:secret:${endpointId}`

@Injectable()
export class WebhooksService {
  private readonly log = new Logger(WebhooksService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
    private readonly cfg: TypedConfigService,
  ) {}

  /**
   * Persist a plaintext signing secret in both places that need it:
   *
   *  - Encrypted (AES-256-GCM) at rest in Postgres — the durable
   *    source of truth. The scheduler decrypts at boot to warm the
   *    Redis cache, so a Redis flush doesn't break deliveries.
   *  - Plaintext in Redis — the hot cache the delivery worker reads
   *    on every send. Avoids decrypting on the hot path.
   *
   * Both writes happen here so the two surfaces never drift. If
   * either fails the caller sees an error and the merchant can retry.
   */
  private async persistSigningSecret(endpointId: string, plaintext: string): Promise<string> {
    const ciphertext = await encryptAesGcm(plaintext, this.cfg.env.WEBHOOK_SECRET_ENCRYPTION_KEY)
    try {
      await this.redis.client.set(SECRET_CACHE_KEY(endpointId), plaintext)
    } catch (err) {
      this.log.error(
        `failed to cache signing secret for endpoint ${endpointId}: ${(err as Error).message}`,
      )
      throw err
    }
    return ciphertext
  }

  // ----- Endpoints -----

  async createEndpoint(
    merchantId: string,
    input: CreateWebhookEndpointInput,
  ): Promise<CreateWebhookEndpointOutput> {
    await assertSafeUrl(input.url)
    const secret = `whsec_${randomBase64Url(32)}`
    const signingSecretHash = await sha256Hex(secret)

    // Insert the row first so we have an id to encrypt against.
    // The ciphertext column is nullable in the schema — we patch it
    // in the next step rather than wedge encryption inside the
    // initial INSERT.
    const row = await this.prisma.db.merchantWebhookEndpoint.create({
      data: {
        merchantId,
        url: input.url,
        events: input.events.map((e) => e.replace(/\./g, '_')) as never,
        mode: input.mode,
        description: input.description ?? null,
        signingSecretHash,
        signingSecretPrefix: secret.slice(0, 12),
      },
    })
    const ciphertext = await this.persistSigningSecret(row.id, secret)
    const withCiphertext = await this.prisma.db.merchantWebhookEndpoint.update({
      where: { id: row.id },
      data: { signingSecretCiphertext: ciphertext },
    })
    return {
      endpoint: serialiseEndpoint(withCiphertext),
      signingSecret: secret,
    }
  }

  async retrieveEndpoint(merchantId: string, id: string): Promise<WebhookEndpoint> {
    const row = await this.prisma.db.merchantWebhookEndpoint.findFirst({
      where: { id, merchantId },
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'endpoint not found' })
    return serialiseEndpoint(row)
  }

  async listEndpoints(merchantId: string, params: { limit?: number; cursor?: string | null }) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.merchantWebhookEndpoint.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialiseEndpoint)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  async setEndpointStatus(
    merchantId: string,
    id: string,
    status: 'active' | 'disabled',
  ): Promise<WebhookEndpoint> {
    const row = await this.prisma.db.merchantWebhookEndpoint.findFirst({
      where: { id, merchantId },
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'endpoint not found' })
    const updated = await this.prisma.db.merchantWebhookEndpoint.update({
      where: { id },
      data: { status },
    })
    return serialiseEndpoint(updated)
  }

  async rotateSecret(merchantId: string, id: string): Promise<CreateWebhookEndpointOutput> {
    const row = await this.prisma.db.merchantWebhookEndpoint.findFirst({
      where: { id, merchantId },
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'endpoint not found' })
    const secret = `whsec_${randomBase64Url(32)}`
    const signingSecretHash = await sha256Hex(secret)
    const ciphertext = await this.persistSigningSecret(id, secret)
    const updated = await this.prisma.db.merchantWebhookEndpoint.update({
      where: { id },
      data: {
        signingSecretHash,
        signingSecretCiphertext: ciphertext,
        signingSecretPrefix: secret.slice(0, 12),
      },
    })
    return { endpoint: serialiseEndpoint(updated), signingSecret: secret }
  }

  // ----- Deliveries -----

  async retrieveDelivery(merchantId: string, id: string): Promise<WebhookDelivery> {
    const row = await this.prisma.db.webhookDelivery.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'delivery not found' })
    return serialiseDelivery(row)
  }

  async listDeliveries(
    merchantId: string,
    params: {
      limit?: number
      cursor?: string | null
      endpointId?: string
      status?: string
      eventName?: string
    },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.webhookDelivery.findMany({
      where: {
        merchantId,
        endpointId: params.endpointId ?? undefined,
        status: (params.status as never) ?? undefined,
        eventName: params.eventName ? (params.eventName.replace(/\./g, '_') as never) : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialiseDelivery)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  async replay(merchantId: string, id: string): Promise<WebhookDelivery> {
    const row = await this.prisma.db.webhookDelivery.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'delivery not found' })

    const endpoint = await this.prisma.db.merchantWebhookEndpoint.findUnique({
      where: { id: row.endpointId },
    })
    if (!endpoint) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: 'original endpoint no longer exists',
      })
    }

    const reset = await this.prisma.db.webhookDelivery.update({
      where: { id: row.id },
      data: {
        status: 'pending',
        attempt: 1,
        nextAttemptAt: null,
        lastError: null,
        responseCode: null,
      },
    })

    await this.queue.queue(QUEUE_NAMES.webhookDelivery).add('deliver', {
      deliveryId: reset.deliveryId,
      endpointId: endpoint.id,
      url: endpoint.url,
      signingSecretHash: endpoint.signingSecretHash,
      eventId: reset.eventId,
      replay: true,
    })

    return serialiseDelivery(reset)
  }
}

function serialiseEndpoint(row: any): WebhookEndpoint {
  return {
    id: row.id,
    merchantId: row.merchantId,
    mode: row.mode,
    url: row.url,
    description: row.description,
    events: row.events.map((e: string) =>
      e
        .replace(/_/g, '.')
        .replace(
          /\.(read|write|created|completed|failed|charged|charge\.failed|recovery\.attempt|recovery\.outcome|cancelled|lapsed|paid|overdue|action\.executed|job\.proposed|job\.completed|job\.disputed|wallet\.flagged|wallet\.blocked)/g,
          (_, suffix) => `.${suffix}`,
        ),
    ) as never,
    status: row.status,
    signingSecretPrefix: row.signingSecretPrefix,
    lastDeliveredAt: row.lastDeliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serialiseDelivery(row: any): WebhookDelivery {
  return {
    id: row.id,
    merchantId: row.merchantId,
    endpointId: row.endpointId,
    eventId: row.eventId,
    eventName: prismaEventNameToWire(row.eventName) as never,
    status: row.status,
    attempt: row.attempt,
    responseCode: row.responseCode,
    responseMs: row.responseMs,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function prismaEventNameToWire(name: string): string {
  // payment_completed → payment.completed (only the FIRST underscore is the
  // resource separator; subsequent underscores stay as-is, e.g.
  // subscription_charge_failed → subscription.charge_failed)
  const idx = name.indexOf('_')
  return idx === -1 ? name : `${name.slice(0, idx)}.${name.slice(idx + 1)}`
}

async function assertSafeUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new BadRequestException({ code: 'invalid_request', message: 'webhook url is malformed' })
  }
  if (parsed.protocol !== 'https:') {
    throw new BadRequestException({
      code: 'invalid_request',
      message: 'webhook url must use https://',
    })
  }
  if (await isPrivateOrLoopback(parsed.hostname)) {
    throw new BadRequestException({
      code: 'invalid_request',
      message: 'webhook url resolves to a private or loopback address',
    })
  }
}
