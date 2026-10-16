/**
 * StrimzClient. The secret-key, server-side SDK entry point.
 *
 *   const strimz = new StrimzClient({ apiKey: process.env.STRIMZ_SECRET_KEY })
 *   const session = await strimz.paymentSessions.create({ amount: '1000000', currency: 'USDC' })
 */

import { kindFromKey, modeFromKey, type ApiKeyMode } from '@strimz/shared-config'
import { Fetcher } from './http/fetcher.js'
import { buildBaseHeaders } from './http/headers.js'
import { StrimzAuthenticationError } from './errors.js'
import { MerchantsResource } from './resources/merchants.js'
import { ApiKeysResource } from './resources/api-keys.js'
import { CustomersResource } from './resources/customers.js'
import { PaymentSessionsResource } from './resources/payment-sessions.js'
import { TransactionsResource } from './resources/transactions.js'
import { SubscriptionPlansResource } from './resources/subscription-plans.js'
import { SubscriptionsResource } from './resources/subscriptions.js'
import { RefundsResource } from './resources/refunds.js'
import { WebhookEndpointsResource } from './resources/webhook-endpoints.js'
import { WebhookDeliveriesResource } from './resources/webhook-deliveries.js'
import { InvoicesResource } from './resources/invoices.js'
import { StorefrontsResource } from './resources/storefronts.js'
import { AgentsResource } from './resources/agents.js'

export interface StrimzClientOptions {
  /** Secret key. Either `sk_test_...` or `sk_live_...`. Mode is auto-detected. */
  apiKey: string
  /** Override the API base URL. Defaults to `https://api.strimz.finance`. */
  baseUrl?: string
  /** Per-request timeout in milliseconds. Default 30s. */
  timeoutMs?: number
  /** Max network/5xx retries. Default 3. */
  maxRetries?: number
  /** Optional logger callbacks for instrumentation. */
  onRequest?: ConstructorParameters<typeof Fetcher>[0]['onRequest']
  onResponse?: ConstructorParameters<typeof Fetcher>[0]['onResponse']
  /** Override fetch. Use to inject mocks in tests or polyfills in Edge. */
  fetch?: typeof globalThis.fetch
}

const DEFAULT_BASE_URL = 'https://api.strimz.finance'

const SECRET_KEY_IN_BROWSER_MESSAGE =
  'StrimzClient cannot run in a browser: secret keys must stay on your server. Create payment sessions from a server route and pass the session id to the browser. See https://strimz.finance/docs/checkout/server-sessions'

export class StrimzClient {
  /** Resolved mode, either `test` or `live`. Derived from the API key prefix. */
  public readonly mode: ApiKeyMode

  public readonly merchants: MerchantsResource
  public readonly apiKeys: ApiKeysResource
  public readonly customers: CustomersResource
  public readonly paymentSessions: PaymentSessionsResource
  public readonly transactions: TransactionsResource
  public readonly subscriptionPlans: SubscriptionPlansResource
  public readonly subscriptions: SubscriptionsResource
  public readonly refunds: RefundsResource
  public readonly webhookEndpoints: WebhookEndpointsResource
  public readonly webhookDeliveries: WebhookDeliveriesResource
  public readonly invoices: InvoicesResource
  public readonly storefronts: StorefrontsResource
  public readonly agents: AgentsResource

  constructor(options: StrimzClientOptions) {
    if (!options.apiKey || typeof options.apiKey !== 'string') {
      throw new StrimzAuthenticationError(
        { code: 'authentication_error', message: 'apiKey is required' },
        401,
      )
    }
    if (kindFromKey(options.apiKey) !== 'secret') {
      throw new StrimzAuthenticationError(
        {
          code: 'authentication_error',
          message:
            'StrimzClient requires a secret key (sk_test_... or sk_live_...). Use StrimzBrowserClient for publishable keys.',
        },
        401,
      )
    }
    const mode = modeFromKey(options.apiKey)
    if (mode == null) {
      throw new StrimzAuthenticationError(
        { code: 'authentication_error', message: 'Unrecognised API key prefix' },
        401,
      )
    }
    if (classifyRuntime().kind === 'browser') {
      throw new StrimzAuthenticationError({
        code: 'secret_key_in_browser',
        message: SECRET_KEY_IN_BROWSER_MESSAGE,
      })
    }
    this.mode = mode

    const fetcher = new Fetcher({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      baseHeaders: buildBaseHeaders(options.apiKey, detectRuntime()),
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
      onRequest: options.onRequest,
      onResponse: options.onResponse,
      fetch: options.fetch,
    })
    const ctx = { fetcher }

    this.merchants = new MerchantsResource(ctx)
    this.apiKeys = new ApiKeysResource(ctx)
    this.customers = new CustomersResource(ctx)
    this.paymentSessions = new PaymentSessionsResource(ctx)
    this.transactions = new TransactionsResource(ctx)
    this.subscriptionPlans = new SubscriptionPlansResource(ctx)
    this.subscriptions = new SubscriptionsResource(ctx)
    this.refunds = new RefundsResource(ctx)
    this.webhookEndpoints = new WebhookEndpointsResource(ctx)
    this.webhookDeliveries = new WebhookDeliveriesResource(ctx)
    this.invoices = new InvoicesResource(ctx)
    this.storefronts = new StorefrontsResource(ctx)
    this.agents = new AgentsResource(ctx)
  }
}

interface RuntimeGlobals {
  Deno?: unknown
  Bun?: unknown
  WorkerGlobalScope?: unknown
  self?: unknown
  window?: unknown
  document?: unknown
  navigator?: { userAgent?: unknown; product?: unknown }
  process?: { type?: unknown; versions?: { node?: unknown; electron?: unknown } }
}

interface RuntimeClass {
  kind: 'browser' | 'server'
  name: string
}

function classifyRuntime(): RuntimeClass {
  const g: RuntimeGlobals = globalThis
  // @ts-expect-error EdgeRuntime is a Vercel global; not in node types.
  if (typeof EdgeRuntime !== 'undefined') return { kind: 'server', name: 'edge' }
  if (typeof g.Deno !== 'undefined') return { kind: 'server', name: 'deno' }
  if (typeof g.Bun !== 'undefined') return { kind: 'server', name: 'bun' }
  if (g.navigator?.userAgent === 'Cloudflare-Workers') return { kind: 'server', name: 'workerd' }
  const versions = g.process?.versions
  if (versions?.electron && g.process?.type === 'renderer') {
    return { kind: 'browser', name: 'electron-renderer' }
  }
  if (versions?.node) return { kind: 'server', name: `node-${String(versions.node)}` }
  if (typeof g.window !== 'undefined' && typeof g.document !== 'undefined') {
    return { kind: 'browser', name: 'browser' }
  }
  const workerScope = g.WorkerGlobalScope
  if (typeof workerScope === 'function' && g.self instanceof workerScope) {
    return { kind: 'browser', name: 'browser' }
  }
  if (g.navigator?.product === 'ReactNative') return { kind: 'browser', name: 'react-native' }
  return { kind: 'server', name: 'unknown' }
}

function detectRuntime(): string {
  return classifyRuntime().name
}
