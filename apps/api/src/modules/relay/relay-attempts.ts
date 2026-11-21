import { Injectable } from '@nestjs/common'

import { RedisService } from '../../infra/redis/redis.service.js'

export const RELAY_ATTEMPT_TTL_SECONDS = 2 * 60 * 60
const CANCEL_COUNT_TTL_SECONDS = 24 * 60 * 60

export const COMPARE_AND_SET_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then " +
  "redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) return 1 end return 0"

export function paymentAttemptScope(sessionId: string): string {
  return `relay-attempt:pay:${sessionId}`
}

export function subscriptionAttemptScope(planId: string, payer: string): string {
  return `relay-attempt:sub:${planId}:${payer.toLowerCase()}`
}

@Injectable()
export class RelayAttemptPointers {
  constructor(private readonly redis: RedisService) {}

  current(scope: string): Promise<string | null> {
    return this.redis.client.get(scope)
  }

  async claim(scope: string, expected: string | null, next: string): Promise<boolean> {
    if (expected === null) {
      const set = await this.redis.client.set(scope, next, 'EX', RELAY_ATTEMPT_TTL_SECONDS, 'NX')
      return set === 'OK'
    }
    const swapped = await this.redis.client.eval(
      COMPARE_AND_SET_SCRIPT,
      1,
      scope,
      expected,
      next,
      RELAY_ATTEMPT_TTL_SECONDS,
    )
    return swapped === 1
  }

  /** New relayed cancels for one subscription in the last 24 hours, this one included. */
  async countCancelAttempt(subscriptionId: string): Promise<number> {
    const key = `relay-cancel-count:${subscriptionId}`
    const count = await this.redis.client.incr(key)
    if (count === 1) await this.redis.client.expire(key, CANCEL_COUNT_TTL_SECONDS)
    return count
  }
}
