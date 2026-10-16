import { describe, expect, it } from 'vitest'

import { TurnstileService } from '../../../src/infra/turnstile/turnstile.service.js'
import type { TypedConfigService } from '../../../src/config/index.js'

function config(env: { NODE_ENV: string; TURNSTILE_SECRET_KEY?: string }): TypedConfigService {
  return { env } as unknown as TypedConfigService
}

describe('TurnstileService configuration', () => {
  it('refuses to start in production without a secret', () => {
    expect(() => new TurnstileService(config({ NODE_ENV: 'production' }))).toThrow(
      /TURNSTILE_SECRET_KEY/u,
    )
  })

  it('starts in production with a secret', () => {
    expect(
      () =>
        new TurnstileService(
          config({ NODE_ENV: 'production', TURNSTILE_SECRET_KEY: '0x4AAAAAAA-test-secret' }),
        ),
    ).not.toThrow()
  })

  it.each(['development', 'test'])('starts without a secret when NODE_ENV=%s', (NODE_ENV) => {
    expect(() => new TurnstileService(config({ NODE_ENV }))).not.toThrow()
  })
})
