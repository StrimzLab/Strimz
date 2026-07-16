import { SetMetadata } from '@nestjs/common'

/**
 * Per-endpoint rate limit. The global limiter caps every route at
 * 600/min; this decorator tightens specific ones (admin invite, permit
 * nonce lookup) where the 600 default is too loose.
 *
 * `keyBy` picks the bucket:
 *   - `ip`      one bucket per source IP (default; use on unauth routes)
 *   - `actor`   one bucket per authenticated actor (merchant/admin id)
 */
export interface RateLimitOptions {
  max: number
  windowMs: number
  keyBy?: 'ip' | 'actor'
  /** Optional label surfaced in errors + logs. */
  label?: string
}

export const RATE_LIMIT_KEY = 'strimz.rateLimit'

export const RateLimit = (opts: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, {
    keyBy: 'ip',
    ...opts,
  })
