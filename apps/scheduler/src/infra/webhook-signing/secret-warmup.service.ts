import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { decryptAesGcm } from '@strimz/shared-crypto'

import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { WebhookSecretCache } from './secret-cache.service.js'

/**
 * Bootstrap step that warms the Redis-backed `WebhookSecretCache`
 * from Postgres on scheduler startup.
 *
 * Without this: a Redis flush — incident, eviction, or simply a
 * fresh deploy with an empty Redis — would leave the cache empty,
 * the delivery worker would fail every job with "signing secret not
 * in cache," and merchants would have to rotate every endpoint to
 * recover. Postgres becomes the durable source of truth (via the
 * encrypted `signingSecretCiphertext` column), Redis the hot cache
 * for the delivery hot path.
 *
 * Sized to one query + N decrypts at boot. Endpoints without a
 * ciphertext (created before #71 shipped) are skipped with a warning
 * — those still need a rotation to populate the column.
 *
 * Idempotent: re-running overwrites the cache with the same values.
 * Safe to invoke repeatedly during a rolling restart.
 */
@Injectable()
export class WebhookSecretWarmupService implements OnModuleInit {
  private readonly log = new Logger(WebhookSecretWarmupService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: WebhookSecretCache,
    private readonly cfg: TypedConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.prisma.db.merchantWebhookEndpoint.findMany({
      where: { status: 'active' },
      select: { id: true, signingSecretCiphertext: true },
    })

    let warmed = 0
    let skipped = 0
    let failed = 0
    for (const row of rows) {
      if (!row.signingSecretCiphertext) {
        skipped += 1
        continue
      }
      try {
        const plaintext = await decryptAesGcm(
          row.signingSecretCiphertext,
          this.cfg.env.WEBHOOK_SECRET_ENCRYPTION_KEY,
        )
        await this.cache.set(row.id, plaintext)
        warmed += 1
      } catch (err) {
        failed += 1
        this.log.error(`failed to warm secret for endpoint ${row.id}: ${(err as Error).message}`)
      }
    }

    if (failed > 0) {
      this.log.warn(
        `webhook secret warm-up: ${warmed} ok, ${skipped} skipped (pre-#71), ${failed} failed`,
      )
    } else if (skipped > 0) {
      this.log.log(
        `webhook secret warm-up: ${warmed} ok, ${skipped} skipped (pre-#71 — merchant must rotate)`,
      )
    } else {
      this.log.log(`webhook secret warm-up: ${warmed} ok`)
    }
  }
}
