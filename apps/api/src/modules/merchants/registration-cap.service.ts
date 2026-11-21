import { Injectable, Logger } from '@nestjs/common'

import { TypedConfigService } from '../../config/index.js'
import { RedisService } from '../../infra/redis/redis.service.js'

const DAY_SECONDS = 86_400
const DAY_MS = DAY_SECONDS * 1000
const LOOKAHEAD_DAYS = 30

function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

function delayUntil(day: string, now: Date): number {
  return Math.max(0, new Date(`${day}T00:00:00.000Z`).getTime() - now.getTime())
}

/** Caps relayed merchant registrations per UTC day (ADR-2026-11-21-relay-gas-protection). */
@Injectable()
export class RegistrationCapService {
  private readonly log = new Logger(RegistrationCapService.name)

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Books the registration into the first UTC day with room and returns how long to hold it.
   * A merchant keeps its booking, so a repeated request doesn't count twice.
   */
  async delayMs(merchantId: string, now = new Date()): Promise<number> {
    const bookingKey = `relay:registration:${merchantId}`
    const booked = await this.redis.client.get(bookingKey)
    if (booked !== null) return delayUntil(booked, now)

    const cap = this.cfg.env.REGISTRATION_DAILY_CAP
    for (let offset = 0; offset < LOOKAHEAD_DAYS; offset++) {
      const day = utcDay(new Date(now.getTime() + offset * DAY_MS))
      const key = `relay:registrations:${day}`
      const ttl = (offset + 2) * DAY_SECONDS
      const used = await this.redis.client.incr(key)
      if (used === 1) await this.redis.client.expire(key, ttl)
      if (used <= cap) {
        await this.redis.client.set(bookingKey, day, 'EX', ttl)
        if (offset > 0)
          this.log.warn(`registration for ${merchantId} held until ${day}: daily cap reached`)
        return delayUntil(day, now)
      }
    }
    throw new Error(`the registration cap is full for the next ${LOOKAHEAD_DAYS} days`)
  }
}
