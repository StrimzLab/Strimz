import { Injectable } from '@nestjs/common'
import { RedisService } from '../redis/redis.service.js'

/**
 * Caches webhook signing secrets in Redis.
 *
 * The API generates a secret at endpoint creation time, hashes it with
 * sha256 for the Postgres index, and writes the plaintext to Redis under
 * `webhook:secret:<endpointId>`. The scheduler reads it here to sign
 * outbound requests; rotation is an atomic `set`.
 *
 * Why Redis and not Postgres for the plaintext: Postgres dumps are the
 * single most common sensitive-data leak vector. An in-memory store
 * scoped separately to the same network keeps blast radius small while
 * staying simple — no KMS dependency, no per-request remote call on the
 * hot path of webhook delivery.
 */
@Injectable()
export class WebhookSecretCache {
  private readonly keyPrefix = 'webhook:secret:'

  constructor(private readonly redis: RedisService) {}

  async get(endpointId: string): Promise<string | null> {
    return this.redis.client.get(this.keyPrefix + endpointId)
  }

  async set(endpointId: string, secret: string): Promise<void> {
    await this.redis.client.set(this.keyPrefix + endpointId, secret)
  }

  async delete(endpointId: string): Promise<void> {
    await this.redis.client.del(this.keyPrefix + endpointId)
  }
}
