import { Injectable, Logger } from '@nestjs/common'
import { TypedConfigService } from '../../config/index.js'
import { RedisService } from '../redis/redis.service.js'

/**
 * Per-UTC-day send counter in Redis. Non-critical sends stop when the
 * count crosses `DAILY_EMAIL_BUDGET`; critical sends still fire (with
 * a warning) so a receipt is never silently dropped.
 */
@Injectable()
export class EmailBudgetService {
  private readonly log = new Logger(EmailBudgetService.name)
  private readonly budget: number

  constructor(
    private readonly redis: RedisService,
    cfg: TypedConfigService,
  ) {
    this.budget = cfg.env.DAILY_EMAIL_BUDGET
  }

  async reserve(critical: boolean): Promise<{ allowed: boolean; countAfter: number }> {
    const key = todayKey()
    const countAfter = await this.redis.client.incr(key)
    if (countAfter === 1) {
      await this.redis.client.expire(key, 60 * 60 * 48)
    }
    const overBudget = countAfter > this.budget
    if (overBudget && !critical) {
      this.log.warn(
        `daily email budget reached (${countAfter}/${this.budget}); deferring non-critical send`,
      )
      return { allowed: false, countAfter }
    }
    if (overBudget && critical) {
      this.log.warn(
        `daily email budget reached (${countAfter}/${this.budget}); sending critical anyway`,
      )
    }
    return { allowed: true, countAfter }
  }
}

function todayKey(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `strimz:email:budget:${y}-${m}-${day}`
}
