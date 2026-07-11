import { Injectable, Logger } from '@nestjs/common'
import { decryptAesGcm } from '@strimz/shared-crypto'

import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { RedisService } from '../redis/redis.service.js'

/**
 * Webhook signing-secret store.
 *
 * Hot path lookup hits Redis. On a cache miss we fall back to the
 * encrypted ciphertext in Postgres, decrypt, and re-cache — so a
 * Redis flush (incident, eviction, fresh deploy) recovers on the
 * next delivery attempt without a manual rotation.
 *
 * Postgres holds `signingSecretCiphertext` (AES-256-GCM) as the
 * durable source of truth; Redis is soft state.
 */
@Injectable()
export class WebhookSecretCache {
  private readonly log = new Logger(WebhookSecretCache.name)
  private readonly keyPrefix = 'webhook:secret:'

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
  ) {}

  async get(endpointId: string): Promise<string | null> {
    const cached = await this.redis.client.get(this.keyPrefix + endpointId)
    if (cached) return cached
    return this.rehydrate(endpointId)
  }

  async set(endpointId: string, secret: string): Promise<void> {
    await this.redis.client.set(this.keyPrefix + endpointId, secret)
  }

  async delete(endpointId: string): Promise<void> {
    await this.redis.client.del(this.keyPrefix + endpointId)
  }

  // Decrypt from Postgres and re-cache. Logs at warn so cache misses
  // are visible in metrics without breaking the delivery.
  private async rehydrate(endpointId: string): Promise<string | null> {
    const row = await this.prisma.db.merchantWebhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { signingSecretCiphertext: true },
    })
    if (!row?.signingSecretCiphertext) return null

    try {
      const plaintext = await decryptAesGcm(
        row.signingSecretCiphertext,
        this.cfg.env.WEBHOOK_SECRET_ENCRYPTION_KEY,
      )
      await this.set(endpointId, plaintext)
      this.log.warn(`rehydrated webhook secret from postgres endpoint=${endpointId}`)
      return plaintext
    } catch (err) {
      this.log.error(`decrypt failed for endpoint ${endpointId}: ${(err as Error).message}`)
      return null
    }
  }
}
