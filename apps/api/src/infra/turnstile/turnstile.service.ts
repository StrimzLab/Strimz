import { Injectable, Logger } from '@nestjs/common'
import { TypedConfigService } from '../../config/index.js'

/**
 * Cloudflare Turnstile adapter.
 *
 * `disabled` mode: when `TURNSTILE_SECRET_KEY` is unset, every check passes.
 * Suitable for local dev. In staging / prod, the env var is required and a
 * missing/invalid token returns false → the caller (signup endpoint) rejects.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
@Injectable()
export class TurnstileService {
  private readonly log = new Logger(TurnstileService.name)
  private readonly secretKey: string | undefined

  constructor(cfg: TypedConfigService) {
    this.secretKey = cfg.env.TURNSTILE_SECRET_KEY
    if (!this.secretKey) {
      this.log.warn(
        'TURNSTILE_SECRET_KEY not set — bot-protection is disabled (OK in dev / test).',
      )
    }
  }

  /** True when Turnstile considers the token valid. Disabled mode always true. */
  async verify(token: string | null | undefined, remoteIp?: string): Promise<boolean> {
    if (!this.secretKey) return true
    if (!token) return false

    try {
      const body = new URLSearchParams({ secret: this.secretKey, response: token })
      if (remoteIp) body.set('remoteip', remoteIp)
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
      if (!data.success) {
        this.log.warn(
          `turnstile rejected token: ${(data['error-codes'] ?? []).join(',')}`,
        )
      }
      return data.success === true
    } catch (err) {
      this.log.error(`turnstile verify error: ${(err as Error).message}`)
      // Fail closed in production, fail open in dev to avoid false-positive churn.
      return false
    }
  }
}
