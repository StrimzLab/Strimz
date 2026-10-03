import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ModulesContainer } from '@nestjs/core'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js'
import type { Type } from '@nestjs/common'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { ApiKeyGuard } from '../../src/common/guards/api-key.guard.js'
import { MerchantAuthGuard } from '../../src/common/guards/merchant-auth.guard.js'
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator.js'
import { REQUIRED_SCOPES_KEY } from '../../src/common/decorators/scopes.decorator.js'
import { SESSION_ONLY_KEY } from '../../src/common/decorators/session-only.decorator.js'

interface KeyRoute {
  route: string
  scopes: unknown
  sessionOnly: unknown
}

function guardsOf(target: object): unknown[] {
  return (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[]
}

function keyRoutes(t: TestApp): KeyRoute[] {
  const controllers = new Set<Type>()
  for (const mod of t.app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      if (wrapper.metatype) controllers.add(wrapper.metatype as Type)
    }
  }
  const routes: KeyRoute[] = []
  for (const controller of controllers) {
    const proto = controller.prototype as Record<string, unknown>
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name]
      if (name === 'constructor' || typeof handler !== 'function') continue
      if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue
      if (Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue
      if (Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true) continue
      if (Reflect.getMetadata(IS_PUBLIC_KEY, controller) === true) continue
      const guards = [...guardsOf(controller), ...guardsOf(handler)]
      if (!guards.includes(MerchantAuthGuard) && !guards.includes(ApiKeyGuard)) continue
      routes.push({
        route: `${controller.name}.${name}`,
        scopes:
          Reflect.getMetadata(REQUIRED_SCOPES_KEY, handler) ??
          Reflect.getMetadata(REQUIRED_SCOPES_KEY, controller),
        sessionOnly:
          Reflect.getMetadata(SESSION_ONLY_KEY, handler) ??
          Reflect.getMetadata(SESSION_ONLY_KEY, controller),
      })
    }
  }
  return routes
}

describe('api key route access declarations', () => {
  let t: TestApp
  let routes: KeyRoute[]

  beforeAll(async () => {
    t = await createTestApp()
    routes = keyRoutes(t)
  })
  afterAll(async () => {
    await t.close()
  })

  it('finds the key-authenticated routes of every registered controller', () => {
    expect(routes.length).toBeGreaterThan(60)
    expect(routes.map((r) => r.route)).toContain('RelayController.submitPayment')
  })

  it('every key-authenticated route declares @RequireScopes or @SessionOnly', () => {
    const undeclared = routes
      .filter(
        (r) =>
          r.sessionOnly !== true &&
          !(Array.isArray(r.scopes) && (r.scopes as unknown[]).length > 0),
      )
      .map((r) => r.route)
    expect(undeclared).toEqual([])
  })

  it('marks exactly the dashboard-only routes as session only', () => {
    const sessionOnly = routes
      .filter((r) => r.sessionOnly === true)
      .map((r) => r.route)
      .sort()
    expect(sessionOnly).toEqual([
      'MerchantsController.changeTier',
      'MerchantsController.onboard',
      'MerchantsController.update',
      'NotificationsController.list',
      'NotificationsController.markAllRead',
    ])
  })
})
