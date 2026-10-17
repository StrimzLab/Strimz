/* eslint-disable @typescript-eslint/no-explicit-any */
import { COMPARE_AND_SET_SCRIPT } from '../../../src/modules/relay/relay-attempts.js'

/** In-memory Redis with the few commands the API uses outside BullMQ. TTLs are ignored. */
export class StubRedisService {
  private readonly store = new Map<string, string>()
  public readonly client: any = {
    get: (key: string) => Promise.resolve(this.store.get(key) ?? null),
    set: (key: string, value: string, ...flags: unknown[]) => {
      if (flags.includes('NX') && this.store.has(key)) return Promise.resolve(null)
      this.store.set(key, value)
      return Promise.resolve('OK')
    },
    eval: (script: string, _numKeys: number, key: string, expected: string, next: string) => {
      if (script !== COMPARE_AND_SET_SCRIPT) {
        return Promise.reject(new Error('StubRedisService only runs COMPARE_AND_SET_SCRIPT'))
      }
      if (this.store.get(key) !== expected) return Promise.resolve(0)
      this.store.set(key, next)
      return Promise.resolve(1)
    },
    del: (key: string) => Promise.resolve(this.store.delete(key) ? 1 : 0),
    quit: () => Promise.resolve('OK'),
    on: () => undefined,
  }
  keys(): string[] {
    return [...this.store.keys()]
  }
  reset(): void {
    this.store.clear()
  }
  async onModuleDestroy(): Promise<void> {
    /* no-op */
  }
}
