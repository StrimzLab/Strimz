import { Injectable } from '@nestjs/common'
import { hmacSha256Hex } from '@strimz/shared-crypto'

/**
 * Stripe-style HMAC-SHA256 signing for outbound webhook deliveries.
 *
 * Signature format (sent as `Strimz-Signature` header):
 *
 *   t=<unix-seconds>,v1=<hex sha256(t.body)>
 *
 * The receiver re-computes `hmac(secret, "${t}.${body}")`, compares
 * timing-safe, and rejects requests where `|now − t| > 300s` (replay
 * window). The 5-minute tolerance gives clock skew + minor delivery
 * latency without leaving stale signatures replayable forever.
 *
 * `signingSecret` is the merchant's per-endpoint secret — generated at
 * endpoint creation, returned ONCE, sha256'd at rest. The scheduler must
 * derive the plaintext secret from somewhere; M1 stores it in Redis under
 * the endpoint id at creation time. M2 will move to a KMS-backed vault.
 *
 * For now the scheduler reads the plaintext from a Redis-backed cache;
 * see `WebhookSecretCache`.
 */
@Injectable()
export class WebhookSigningService {
  /**
   * Build the `Strimz-Signature` header value for a body + timestamp.
   *
   * Returns `t=<unix>,v1=<hex>` ready to slot into a header.
   */
  async buildSignatureHeader(secret: string, body: string, nowMs = Date.now()): Promise<string> {
    const ts = Math.floor(nowMs / 1000).toString()
    const signed = `${ts}.${body}`
    const v1 = await hmacSha256Hex(secret, signed)
    return `t=${ts},v1=${v1}`
  }
}
