import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ModulesContainer } from '@nestjs/core'
import { RequestMethod, type Type } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js'
import { StrimzBrowserClient, StrimzClient, StrimzError } from '@strimz/sdk'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { ApiKeyGuard } from '../../src/common/guards/api-key.guard.js'
import { MerchantAuthGuard } from '../../src/common/guards/merchant-auth.guard.js'
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator.js'
import { REQUIRED_SCOPES_KEY } from '../../src/common/decorators/scopes.decorator.js'
import { SESSION_ONLY_KEY } from '../../src/common/decorators/session-only.decorator.js'

type MethodArgs<R> = {
  [M in keyof R as R[M] extends (...args: never[]) => unknown ? M : never]: R[M] extends (
    ...args: infer A
  ) => unknown
    ? A
    : never
}

type ClientCalls<C> = {
  [R in keyof C as C[R] extends object ? R : never]: MethodArgs<C[R]>
}

interface Route {
  handler: string
  method: string
  path: string
  pattern: RegExp
  params: number
  public: boolean
  guards: unknown[]
  sessionOnly: boolean
  scopes: unknown[]
}

interface Captured {
  call: string
  method: string
  path: string
}

const ID = 'id_parity'
const ADDRESS = '0x0000000000000000000000000000000000000001'
const TX_HASH = `0x${'a'.repeat(64)}`
const CAPTURE_STATUS = 418
const CAPTURE_CODE = 'parity_capture'

const serverCalls: ClientCalls<StrimzClient> = {
  merchants: {
    me: [],
  },
  apiKeys: {
    list: [],
    retrieve: [ID],
    create: [{ name: 'parity', kind: 'secret', mode: 'test', scopes: ['sessions_read'] }],
    revoke: [ID],
  },
  customers: {
    retrieve: [ID],
    list: [],
    upsert: [{ walletAddress: ADDRESS }],
  },
  paymentSessions: {
    create: [{ amount: '1000000', currency: 'USDC' }],
    retrieve: [ID],
    list: [],
    cancel: [ID],
    expire: [ID],
  },
  transactions: {
    retrieve: [ID],
    list: [],
  },
  subscriptionPlans: {
    create: [{ name: 'Pro', amount: '1000000', currency: 'USDC', interval: 'monthly' }],
    retrieve: [ID],
    list: [],
    archive: [ID],
  },
  subscriptions: {
    retrieve: [ID],
    list: [],
    cancel: [{ id: ID }],
  },
  refunds: {
    create: [{ transactionId: ID, amount: '1', reason: 'customer_request' }],
    retrieve: [ID],
    list: [],
    submitSignature: [{ id: ID, refundTxHash: TX_HASH }],
  },
  webhookEndpoints: {
    create: [{ url: 'https://example.com/hook', events: ['payment.completed'], mode: 'test' }],
    retrieve: [ID],
    list: [],
    disable: [ID],
    enable: [ID],
    rotateSecret: [ID],
  },
  webhookDeliveries: {
    retrieve: [ID],
    list: [],
    replay: [ID],
  },
  invoices: {
    create: [
      {
        lineItems: [{ description: 'Seat', quantity: 1, unitAmount: '1000000' }],
        currency: 'USDC',
      },
    ],
    retrieve: [ID],
    list: [],
    send: [ID],
    void: [ID],
  },
  storefronts: {
    retrieve: [],
    upsert: [
      {
        slug: 'parity-store',
        name: 'Parity Store',
        description: null,
        logoUrl: null,
        coverImageUrl: null,
        accentColor: null,
      },
    ],
    publish: [],
    archive: [],
    listProducts: [],
    createProduct: [
      {
        name: 'Sticker',
        description: null,
        price: '1000000',
        currency: 'USDC',
        type: 'one_time',
        interval: null,
        intervalCount: null,
        stock: null,
        isActive: true,
      },
    ],
    retrieveProduct: [ID],
    archiveProduct: [ID],
  },
  agents: {
    retrieveConfig: [],
    updateConfig: [{}],
    listActivity: [],
    listJobs: [],
    retrieveJob: [ID],
    createJob: [
      { vendorAddress: ADDRESS, description: 'Audit', amount: '1000000', currency: 'USDC' },
    ],
    approveJob: [ID],
  },
}

const browserCalls: ClientCalls<StrimzBrowserClient> = {
  checkout: {
    session: [ID],
    plan: [ID],
    merchant: [ID],
    subscriptionStatus: [ID, ADDRESS],
    planTerms: [ID, ADDRESS],
  },
  tokens: {
    retrieve: [ADDRESS],
    permitNonce: [ADDRESS, ADDRESS],
  },
}

function joinPath(...parts: string[]): string {
  const joined = parts
    .filter((p) => p.length > 0)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
  return joined.startsWith('/') ? joined : `/${joined}`
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  return [typeof value === 'string' ? value : '']
}

function metadataOf(key: string, handler: object, controller: object): unknown {
  return Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller)
}

function registeredRoutes(t: TestApp): Route[] {
  const controllers = new Set<Type>()
  for (const mod of t.app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      if (wrapper.metatype) controllers.add(wrapper.metatype as Type)
    }
  }
  const routes: Route[] = []
  for (const controller of controllers) {
    const proto = controller.prototype as Record<string, unknown>
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name]
      if (name === 'constructor' || typeof handler !== 'function') continue
      const verb = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined
      if (verb === undefined) continue
      const handlerPaths = Reflect.getMetadata(PATH_METADATA, handler) as unknown
      if (handlerPaths === undefined) continue
      for (const base of asList(Reflect.getMetadata(PATH_METADATA, controller))) {
        for (const sub of asList(handlerPaths)) {
          const path = joinPath(base, sub)
          const segments = path.split('/')
          routes.push({
            handler: `${controller.name}.${name}`,
            method: RequestMethod[verb],
            path,
            pattern: new RegExp(
              `^${segments.map((s) => (s.startsWith(':') ? '[^/]+' : s)).join('/')}$`,
            ),
            params: segments.filter((s) => s.startsWith(':')).length,
            public: metadataOf(IS_PUBLIC_KEY, handler, controller) === true,
            guards: [
              ...((Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[]),
              ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[]),
            ],
            sessionOnly: metadataOf(SESSION_ONLY_KEY, handler, controller) === true,
            scopes: (metadataOf(REQUIRED_SCOPES_KEY, handler, controller) ?? []) as unknown[],
          })
        }
      }
    }
  }
  return routes
}

function matchRoute(routes: Route[], captured: Captured): Route | undefined {
  return routes
    .filter((r) => r.method === captured.method && r.pattern.test(captured.path))
    .sort((a, b) => a.params - b.params)[0]
}

function secretKeyCanCall(route: Route): boolean {
  if (route.public || route.guards.length === 0) return true
  const keyGuards = route.guards.every((g) => g === MerchantAuthGuard || g === ApiKeyGuard)
  return keyGuards && !route.sessionOnly && route.scopes.length > 0
}

function publishableKeyCanCall(route: Route): boolean {
  return route.public || route.guards.length === 0
}

function recordingFetch(sink: Captured[], current: { call: string }): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    sink.push({ call: current.call, method: init?.method ?? 'GET', path: url.pathname })
    return Promise.resolve(
      new Response(JSON.stringify({ code: CAPTURE_CODE, message: current.call }), {
        status: CAPTURE_STATUS,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }) as typeof fetch
}

function listedMethods(client: object): string[] {
  const names: string[] = []
  for (const [resourceName, resource] of Object.entries(client)) {
    if (resource === null || typeof resource !== 'object') continue
    const proto = Object.getPrototypeOf(resource) as object
    for (const method of Object.getOwnPropertyNames(proto)) {
      if (method === 'constructor') continue
      if (typeof (resource as Record<string, unknown>)[method] !== 'function') continue
      names.push(`${resourceName}.${method}`)
    }
  }
  return names.sort()
}

function fixtureKeys(calls: Record<string, Record<string, unknown[]>>): string[] {
  return Object.entries(calls)
    .flatMap(([resource, methods]) => Object.keys(methods).map((m) => `${resource}.${m}`))
    .sort()
}

async function driveAll(
  client: object,
  calls: Record<string, Record<string, unknown[]>>,
  current: { call: string },
  sink: Captured[],
): Promise<string[]> {
  const uncaptured: string[] = []
  for (const [resourceName, methods] of Object.entries(calls)) {
    const resource = (client as Record<string, Record<string, (...a: unknown[]) => unknown>>)[
      resourceName
    ]
    for (const [method, args] of Object.entries(methods)) {
      current.call = `${resourceName}.${method}`
      const before = sink.length
      const outcome = await Promise.resolve()
        .then(() => resource?.[method]?.(...args))
        .then(
          () => 'resolved',
          (err: unknown) =>
            err instanceof StrimzError && err.httpStatus === CAPTURE_STATUS
              ? 'captured'
              : String(err),
        )
      if (outcome !== 'captured' || sink.length - before !== 1) {
        uncaptured.push(`${current.call}: ${sink.length - before} requests, ${outcome}`)
      }
    }
  }
  return uncaptured
}

describe('sdk route parity', () => {
  let t: TestApp
  let routes: Route[]
  const serverCaptured: Captured[] = []
  const browserCaptured: Captured[] = []
  let server: StrimzClient
  let browser: StrimzBrowserClient
  let serverUncaptured: string[]
  let browserUncaptured: string[]

  beforeAll(async () => {
    t = await createTestApp()
    routes = registeredRoutes(t)

    const serverCurrent = { call: '' }
    server = new StrimzClient({
      apiKey: `sk_test_${'a'.repeat(32)}`,
      baseUrl: 'http://parity.invalid',
      maxRetries: 0,
      fetch: recordingFetch(serverCaptured, serverCurrent),
    })
    serverUncaptured = await driveAll(
      server,
      serverCalls as unknown as Record<string, Record<string, unknown[]>>,
      serverCurrent,
      serverCaptured,
    )

    const browserCurrent = { call: '' }
    vi.stubGlobal('fetch', recordingFetch(browserCaptured, browserCurrent))
    try {
      browser = new StrimzBrowserClient({
        publishableKey: `pk_test_${'a'.repeat(32)}`,
        baseUrl: 'http://parity.invalid',
      })
    } finally {
      vi.unstubAllGlobals()
    }
    browserUncaptured = await driveAll(
      browser,
      browserCalls as unknown as Record<string, Record<string, unknown[]>>,
      browserCurrent,
      browserCaptured,
    )
  })
  afterAll(async () => {
    await t.close()
  })

  it('reads the routes of every registered controller', () => {
    expect(routes.length).toBeGreaterThan(80)
    expect(routes.map((r) => `${r.method} ${r.path}`)).toContain('GET /v1/subscriptions/:id')
  })

  it('has a call for every StrimzClient method and nothing else', () => {
    expect(
      fixtureKeys(serverCalls as unknown as Record<string, Record<string, unknown[]>>),
    ).toEqual(listedMethods(server))
  })

  it('has a call for every StrimzBrowserClient method and nothing else', () => {
    expect(
      fixtureKeys(browserCalls as unknown as Record<string, Record<string, unknown[]>>),
    ).toEqual(listedMethods(browser))
  })

  it('sends exactly one request from every SDK method', () => {
    expect(serverUncaptured).toEqual([])
    expect(browserUncaptured).toEqual([])
    expect(serverCaptured.map((c) => c.call).sort()).toEqual(listedMethods(server))
    expect(browserCaptured.map((c) => c.call).sort()).toEqual(listedMethods(browser))
  })

  it('maps every StrimzClient method to a registered API route', () => {
    const missing = serverCaptured
      .filter((c) => matchRoute(routes, c) === undefined)
      .map((c) => `${c.call} -> ${c.method} ${c.path}`)
    expect(missing).toEqual([])
  })

  it('maps every StrimzClient method to a route a secret key may call', () => {
    const refused = serverCaptured
      .map((c) => ({ c, route: matchRoute(routes, c) }))
      .filter(({ route }) => route !== undefined && !secretKeyCanCall(route))
      .map(({ c, route }) => `${c.call} -> ${route?.method} ${route?.path} (${route?.handler})`)
    expect(refused).toEqual([])
  })

  it('maps every StrimzBrowserClient method to a public API route', () => {
    const missing = browserCaptured
      .filter((c) => {
        const route = matchRoute(routes, c)
        return route === undefined || !publishableKeyCanCall(route)
      })
      .map((c) => `${c.call} -> ${c.method} ${c.path}`)
    expect(missing).toEqual([])
  })
})
