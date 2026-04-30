import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from './env.schema.js'

/** Type-safe wrapper around `ConfigService`. */
@Injectable()
export class TypedConfigService {
  constructor(private readonly nest: ConfigService<Env, true>) {}

  get env(): Env {
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
}
