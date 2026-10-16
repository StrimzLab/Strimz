import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ModulesContainer } from '@nestjs/core'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js'
import type { Type } from '@nestjs/common'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedMerchant,
  seedPaymentSession,
  seedStorefront,
  seedStorefrontProduct,
} from '../helpers/fixtures.js'
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from '../../src/common/decorators/rate-limit.decorator.js'

const PAYER = `0x${'d'.repeat(40)}`
const USDC = '0x3600000000000000000000000000000000000000'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const RATE_LIMIT_EXEMPT = [
  'HealthController.liveness',
  'HealthController.readiness',
  'PrivyWebhookController.receive',
]

const PUBLIC_LIMITS: Record<string, { max: number; windowMs: number }> = {
  'AuthController.sync': { max: 30, windowMs: MINUTE },
  'ContactController.submit': { max: 5, windowMs: HOUR },
  'CheckoutController.retrieveMerchant': { max: 120, windowMs: MINUTE },
  'CheckoutController.retrieveSession': { max: 120, windowMs: MINUTE },
  'CheckoutController.retrievePlan': { max: 120, windowMs: MINUTE },
  'CheckoutController.planSubscriptionStatus': { max: 60, windowMs: MINUTE },
  'CheckoutController.planTerms': { max: 60, windowMs: MINUTE },
  'CheckoutController.attachSessionPayer': { max: 10, windowMs: MINUTE },
  'CheckoutController.attachPlanPayer': { max: 10, windowMs: MINUTE },
  'CheckoutController.relaySessionPayment': { max: 20, windowMs: MINUTE },
  'CheckoutController.relayPlanEnrolment': { max: 20, windowMs: MINUTE },
  'CheckoutController.sessionSubmission': { max: 120, windowMs: MINUTE },
  'CheckoutController.planSubmission': { max: 120, windowMs: MINUTE },
  'TokensController.getMetadata': { max: 60, windowMs: MINUTE },
  'TokensController.getPermitNonce': { max: 30, windowMs: HOUR },
  'StorefrontsController.retrievePublic': { max: 120, windowMs: MINUTE },
  'StorefrontsController.checkoutFromProduct': { max: 10, windowMs: MINUTE },
}

interface DeclaredRoute {
  route: string
  guarded: boolean
  limit: RateLimitOptions | undefined
}

function declaredRoutes(t: TestApp): DeclaredRoute[] {
  const controllers = new Set<Type>()
  for (const mod of t.app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      if (wrapper.metatype) controllers.add(wrapper.metatype as Type)
    }
  }
  const routes: DeclaredRoute[] = []
  for (const controller of controllers) {
    const proto = controller.prototype as Record<string, unknown>
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name]
      if (name === 'constructor' || typeof handler !== 'function') continue
      if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue
      if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue
      const guards = [
        ...((Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[]),
        ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[]),
      ]
      routes.push({
        route: `${controller.name}.${name}`,
        guarded: guards.length > 0,
        limit: (Reflect.getMetadata(RATE_LIMIT_KEY, handler) ??
          Reflect.getMetadata(RATE_LIMIT_KEY, controller)) as RateLimitOptions | undefined,
      })
    }
  }
  return routes
}

describe('public endpoint hardening e2e', () => {
  let t: TestApp
  let ipCounter = 0
  let remoteAddress = '198.51.100.0'

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.email.reset()
    ipCounter += 1
    remoteAddress = `198.51.100.${ipCounter}`
  })

  const attachSession = (sessionId: string, body: { email: string; walletAddress: string }) =>
    t.inject({
      method: 'POST',
      url: `/v1/checkout/sessions/${sessionId}/payer`,
      payload: body,
      remoteAddress,
    })

  const contact = () =>
    t.inject({
      method: 'POST',
      url: '/v1/contact',
      payload: {
        name: 'Ada Lovelace',
        email: 'ada@example.test',
        topic: 'sales',
        message: 'We would like to talk about volume pricing for our business.',
        turnstileToken: 'good-token',
      },
      remoteAddress,
    })

  describe('POST /v1/checkout/sessions/:id/payer', () => {
    it('limits each source address to 10 attaches a minute', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      const session = await seedPaymentSession(t.prisma.db, m.id)
      const body = { email: 'payer@buyer.test', walletAddress: PAYER }
      for (let i = 0; i < 10; i += 1) {
        expect((await attachSession(session.id, body)).statusCode).toBe(201)
      }
      expect((await attachSession(session.id, body)).statusCode).toBe(429)
    })
  })

  describe('POST /v1/contact', () => {
    it('limits each source address to 5 submissions an hour', async () => {
      for (let i = 0; i < 5; i += 1) {
        expect((await contact()).statusCode).toBe(201)
      }
      const sixth = await contact()

      expect(sixth.statusCode).toBe(429)
      expect(t.email.sent).toHaveLength(5)
    })
  })

  describe('GET /v1/tokens/:address', () => {
    it('limits each source address to 60 metadata reads a minute', async () => {
      const client = t.chain.client as { readContract: (args: unknown) => Promise<unknown> }
      const readContract = client.readContract
      client.readContract = () => Promise.resolve(false)
      try {
        const read = () => t.inject({ method: 'GET', url: `/v1/tokens/${USDC}`, remoteAddress })
        for (let i = 0; i < 60; i += 1) {
          expect((await read()).statusCode).toBe(404)
        }
        expect((await read()).statusCode).toBe(429)
      } finally {
        client.readContract = readContract
      }
    })
  })

  describe('POST /store/:slug/products/:productId/checkout', () => {
    it('limits each source address to 10 checkouts a minute', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      const sf = await seedStorefront(t.prisma.db, m.id, 'shop')
      const product = await seedStorefrontProduct(t.prisma.db, sf.id)
      const buy = () =>
        t.inject({
          method: 'POST',
          url: `/store/shop/products/${product.id}/checkout`,
          payload: {},
          remoteAddress,
        })
      for (let i = 0; i < 10; i += 1) {
        expect((await buy()).statusCode).toBe(201)
      }
      expect((await buy()).statusCode).toBe(429)
    })
  })

  describe('route declarations', () => {
    it('every route without a guard declares @RateLimit, except health and signed webhooks', () => {
      const missing = declaredRoutes(t)
        .filter((r) => !r.guarded && !r.limit && !RATE_LIMIT_EXEMPT.includes(r.route))
        .map((r) => r.route)
        .sort()
      expect(missing).toEqual([])
    })

    it('public routes declare the per-address limits the ADR sets', () => {
      const declared = Object.fromEntries(
        declaredRoutes(t)
          .filter((r) => r.route in PUBLIC_LIMITS)
          .map((r) => [
            r.route,
            r.limit && { max: r.limit.max, windowMs: r.limit.windowMs, keyBy: r.limit.keyBy },
          ]),
      )
      const expected = Object.fromEntries(
        Object.entries(PUBLIC_LIMITS).map(([route, limit]) => [route, { ...limit, keyBy: 'ip' }]),
      )
      expect(declared).toEqual(expected)
    })
  })
})
