import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js'
import { RequestMethod } from '@nestjs/common'
import type { HTTPMethods } from 'fastify'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator.js'
import { isPublicCorsPath, PUBLIC_CORS_PREFIXES } from '../../src/common/http/cors-policy.js'

interface RegisteredRoute {
  method: HTTPMethods
  path: string
  isPublic: boolean
}

function joinPath(controllerPath: string, handlerPath: string): string {
  const joined = `/${controllerPath}/${handlerPath}`.replace(/\/+/g, '/')
  return joined.length > 1 ? joined.replace(/\/$/, '') : joined
}

function collectRoutes(t: TestApp): RegisteredRoute[] {
  const reflector = new Reflector()
  const scanner = new MetadataScanner()
  const routes: RegisteredRoute[] = []
  for (const moduleRef of t.app.get(ModulesContainer).values()) {
    for (const wrapper of moduleRef.controllers.values()) {
      const controller = wrapper.metatype
      if (typeof controller !== 'function') continue
      const controllerPaths = [Reflect.getMetadata(PATH_METADATA, controller) ?? '/'].flat()
      const prototype = controller.prototype as Record<string, unknown>
      for (const name of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name]
        if (typeof handler !== 'function') continue
        const handlerPaths: unknown = Reflect.getMetadata(PATH_METADATA, handler)
        if (handlerPaths === undefined) continue
        const method = RequestMethod[
          Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod
        ] as HTTPMethods
        const isPublic =
          reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, controller]) === true
        for (const controllerPath of controllerPaths as string[]) {
          for (const handlerPath of [handlerPaths].flat() as string[]) {
            routes.push({ method, path: joinPath(controllerPath, handlerPath), isPublic })
          }
        }
      }
    }
  }
  return routes
}

describe('routes under a public CORS prefix', () => {
  let t: TestApp
  let routes: RegisteredRoute[]

  beforeAll(async () => {
    t = await createTestApp()
    routes = collectRoutes(t)
  })
  afterAll(async () => {
    await t.close()
  })

  it('finds every registered checkout and token route', () => {
    const fastify = t.app.getHttpAdapter().getInstance()
    const underPublicPrefix = routes.filter((r) => isPublicCorsPath(r.path))
    for (const prefix of PUBLIC_CORS_PREFIXES) {
      expect(underPublicPrefix.some((r) => r.path.startsWith(prefix))).toBe(true)
    }
    expect(underPublicPrefix.map((r) => `${r.method} ${r.path}`).sort()).toEqual(
      expect.arrayContaining([
        'GET /v1/checkout/merchants/:id',
        'GET /v1/checkout/sessions/:id',
        'POST /v1/checkout/sessions/:id/payer',
        'GET /v1/tokens/:address',
        'GET /v1/tokens/:address/permit-nonce',
      ]),
    )
    for (const r of underPublicPrefix) {
      expect(fastify.hasRoute({ method: r.method, url: r.path })).toBe(true)
    }
  })

  it('are all marked @Public() so the wildcard CORS answer never covers a keyed route', () => {
    const notPublic = routes
      .filter((r) => isPublicCorsPath(r.path) && !r.isPublic)
      .map((r) => `${r.method} ${r.path}`)
    expect(notPublic).toEqual([])
  })
})
