import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from './env.schema.js'

/**
 * A thin, type-safe wrapper around `@nestjs/config`'s `ConfigService`.
 * Use `cfg.env.X` to read validated values; this is the only place the
 * application reads env at runtime.
 */
@Injectable()
export class TypedConfigService {
  constructor(private readonly nest: ConfigService<Env, true>) {}

  /** All env vars (validated). */
  get env(): Env {
    // ConfigService doesn't expose the full object, so we lazily build it.
    // Each key was validated at boot via the validator.
    return new Proxy({} as Env, {
      get: (_t, prop: string) => this.nest.get(prop as keyof Env, { infer: true }),
    })
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production'
  }
  get isTest(): boolean {
    return this.env.NODE_ENV === 'test'
  }
  get isDev(): boolean {
    return this.env.NODE_ENV === 'development'
  }
}
