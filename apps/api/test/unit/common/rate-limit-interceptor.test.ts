import { HttpException, type CallHandler, type ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { lastValueFrom, of } from 'rxjs'
import { afterEach, describe, expect, it } from 'vitest'

import type { RateLimitOptions } from '../../../src/common/decorators/rate-limit.decorator.js'
import { RateLimitInterceptor } from '../../../src/common/interceptors/rate-limit.interceptor.js'

interface FakeRequest {
  method: string
  url: string
  routeOptions: { url: string }
  ip: string
  merchant?: { merchantId: string; mode: 'test' | 'live' }
  admin?: { adminId: string; email: string; role: string }
}

function context(req: FakeRequest): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext
}

const next: CallHandler = { handle: () => of('ok') }

function interceptor(opts: RateLimitOptions): RateLimitInterceptor {
  const reflector = { getAllAndOverride: () => opts } as unknown as Reflector
  return new RateLimitInterceptor(reflector)
}

function request(ip: string, over: Partial<FakeRequest> = {}): FakeRequest {
  return {
    method: 'POST',
    url: '/v1/relay/payments',
    routeOptions: { url: '/v1/relay/payments' },
    ip,
    ...over,
  }
}

async function status(limiter: RateLimitInterceptor, req: FakeRequest): Promise<number> {
  try {
    await lastValueFrom(limiter.intercept(context(req), next))
    return 200
  } catch (err) {
    if (err instanceof HttpException) return err.getStatus()
    throw err
  }
}

describe('RateLimitInterceptor keyBy actor', () => {
  let limiter: RateLimitInterceptor | undefined

  afterEach(() => {
    limiter?.onModuleDestroy()
  })

  it('counts one merchant across source addresses', async () => {
    limiter = interceptor({ max: 2, windowMs: 60_000, keyBy: 'actor' })
    const merchant = { merchantId: 'merchant_a', mode: 'live' as const }

    expect(await status(limiter, request('198.18.0.1', { merchant }))).toBe(200)
    expect(await status(limiter, request('198.18.0.2', { merchant }))).toBe(200)
    expect(await status(limiter, request('198.18.0.3', { merchant }))).toBe(429)
  })

  it('keeps separate buckets for two merchants behind one address', async () => {
    limiter = interceptor({ max: 1, windowMs: 60_000, keyBy: 'actor' })

    const a = request('198.18.0.9', { merchant: { merchantId: 'merchant_a', mode: 'live' } })
    const b = request('198.18.0.9', { merchant: { merchantId: 'merchant_b', mode: 'live' } })

    expect(await status(limiter, a)).toBe(200)
    expect(await status(limiter, b)).toBe(200)
  })

  it('counts one admin across source addresses', async () => {
    limiter = interceptor({ max: 1, windowMs: 60_000, keyBy: 'actor' })
    const admin = { adminId: 'admin_1', email: 'ops@strimz.test', role: 'owner' }

    expect(await status(limiter, request('198.18.1.1', { admin }))).toBe(200)
    expect(await status(limiter, request('198.18.1.2', { admin }))).toBe(429)
  })

  it('falls back to the address when no actor is attached', async () => {
    limiter = interceptor({ max: 1, windowMs: 60_000, keyBy: 'actor' })

    expect(await status(limiter, request('198.18.2.1'))).toBe(200)
    expect(await status(limiter, request('198.18.2.2'))).toBe(200)
    expect(await status(limiter, request('198.18.2.1'))).toBe(429)
  })
})
