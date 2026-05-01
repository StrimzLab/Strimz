import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from './env.schema.js'

@Injectable()
export class TypedConfigService {
  constructor(private readonly nest: ConfigService<Env, true>) {}

  get env(): Env {
    return new Proxy({} as Env, {
      get: (_t, prop: string) => this.nest.get(prop as keyof Env, { infer: true }),
    })
  }
}
