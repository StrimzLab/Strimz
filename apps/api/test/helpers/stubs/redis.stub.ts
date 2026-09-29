/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Minimal Redis stand-in. The real RedisService is only ever consumed via
 * `QueueService` and (in M2+) idempotency caches; replacing the wrapping
 * services with stubs is enough to skip Redis entirely. This stub exists so
 * NestJS DI doesn't blow up on construction of the real one.
 */
export class StubRedisService {
  public readonly client: any = {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve('OK'),
    del: () => Promise.resolve(1),
    quit: () => Promise.resolve('OK'),
    on: () => undefined,
  }
  async onModuleDestroy(): Promise<void> {
    /* no-op */
  }
}
