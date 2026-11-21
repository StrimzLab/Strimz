import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('TurnstileService.verify', () => {
  const service = () =>
    new TurnstileService(config({ NODE_ENV: 'test', TURNSTILE_SECRET_KEY: 'secret' }))
  const siteverify = (result: Record<string, unknown>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(result), { status: 200 }))),
    )

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts a token for the expected action and host', async () => {
    siteverify({ success: true, action: 'signup', hostname: 'app.strimz.finance' })
    await expect(service().verify('t', '1.2.3.4', 'signup', 'app.strimz.finance')).resolves.toBe(
      true,
    )
  })

  it('refuses a token minted on another host', async () => {
    siteverify({ success: true, action: 'signup', hostname: 'evil.example' })
    await expect(service().verify('t', '1.2.3.4', 'signup', 'app.strimz.finance')).resolves.toBe(
      false,
    )
  })
})
