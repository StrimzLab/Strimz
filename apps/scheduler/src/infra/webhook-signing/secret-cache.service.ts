import { Injectable } from '@nestjs/common'
import { RedisService } from '../redis/redis.service.js'

/**
 * Caches webhook signing secrets in Redis.
 *
 * The API generates a secret at endpoint creation time, hashes it with
 * sha256 for the DB index, and (in this M1 cut) writes the plaintext to
 * Redis under `webhook:secret:<endpointId>`. The scheduler reads it here
 * to sign outbound requests.
 *
 * Why Redis and not just store the plaintext in Postgres? Plaintext
 * secrets in the application DB are a known anti-pattern — a Postgres
 * dump is the most common sensitive-data leak vector. Redis is in-memory,
 * separately scoped, and the stored value can be rotated atomically.
 *
 * M2 path: replace Redis with a KMS-backed `signWithKey(endpointId,
 * payload)` interface; the secret never leaves the KMS. M1 ships with
 * Redis to keep the dependency surface tight.
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
