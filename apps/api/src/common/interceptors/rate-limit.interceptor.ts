import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
  OnModuleDestroy,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import type { Observable } from 'rxjs'

import { RATE_LIMIT_KEY, type RateLimitOptions } from '../decorators/rate-limit.decorator.js'

interface Bucket {
  count: number
  resetAt: number
}

// Sweep expired buckets on a timer + at a size ceiling so the Map
// never grows without bound. Ten minutes is well past the longest
// window we set today (1h admin invite / 1h permit nonce) so nothing
// gets swept while still active.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000
const SIZE_CEILING = 10_000

@Injectable()
export class RateLimitInterceptor implements NestInterceptor, OnModuleDestroy {
  private readonly log = new Logger(RateLimitInterceptor.name)
  private readonly buckets = new Map<string, Bucket>()
  private readonly sweepTimer: NodeJS.Timeout

  constructor(private readonly reflector: Reflector) {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
    // Don't hold the event loop open just for the sweep.
    this.sweepTimer.unref?.()
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer)
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!opts) return next.handle()

    const req = context.switchToHttp().getRequest<FastifyRequest & { user?: unknown }>()
    const routeKey = `${req.method}:${req.routeOptions?.url ?? req.url}`
    const bucketKey = `${routeKey}:${this.subjectKey(req, opts.keyBy ?? 'ip')}`

    const now = Date.now()
    const bucket = this.buckets.get(bucketKey)
    if (!bucket || bucket.resetAt <= now) {
      // Belt-and-braces: if the map is very large, sweep synchronously
      // before inserting a new bucket. Amortised cost is small since it
      // only happens once we're past the ceiling.
      if (this.buckets.size >= SIZE_CEILING) this.sweep(now)
      this.buckets.set(bucketKey, { count: 1, resetAt: now + opts.windowMs })
      return next.handle()
    }

    if (bucket.count >= opts.max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000)
      this.log.warn(
        `rate limit hit route=${routeKey} bucket=${bucketKey} label=${opts.label ?? '-'}`,
      )
      throw new HttpException(
        {
          code: 'rate_limited',
          message: `rate limit exceeded for ${opts.label ?? routeKey}`,
          retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    bucket.count += 1
    return next.handle()
  }

  private subjectKey(req: FastifyRequest & { user?: unknown }, keyBy: 'ip' | 'actor'): string {
    if (keyBy === 'actor') {
      const user = req.user as { merchantId?: string; adminId?: string } | undefined
      if (user?.merchantId) return `m:${user.merchantId}`
      if (user?.adminId) return `a:${user.adminId}`
    }
    return `ip:${req.ip ?? 'unknown'}`
  }

  private sweep(now = Date.now()): void {
    let removed = 0
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key)
        removed += 1
      }
    }
    if (removed > 0)
      this.log.debug(`rate-limit sweep: removed=${removed} remaining=${this.buckets.size}`)
  }
}
