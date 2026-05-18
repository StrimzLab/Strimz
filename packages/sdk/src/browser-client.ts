/**
 * StrimzBrowserClient — the publishable-key, browser-safe SDK entry point.
 *
 * Used by `@strimz/sdk-react` and any other browser code that should
 * never see a secret key. Surfaces a strict subset of resource methods —
 * only those safe to call from a browser with a `pk_test_...` or
 * `pk_live_...` key.
 */

import { kindFromKey, modeFromKey, type ApiKeyMode } from '@strimz/shared-config'
import { Fetcher } from './http/fetcher.js'
import { buildBaseHeaders } from './http/headers.js'
import { StrimzAuthenticationError } from './errors.js'
import { PaymentSessionsResource } from './resources/payment-sessions.js'
import {
  TokensResource,
  selectPaymentPath,
  selectSubscriptionPath,
  type RelayPath,
} from './resources/tokens.js'

export interface StrimzBrowserClientOptions {
  /** Publishable key — `pk_test_...` or `pk_live_...`. */
  publishableKey: string
  /** Override the API base URL. */
  baseUrl?: string
  /** Per-request timeout in milliseconds. Default 30s. */
  timeoutMs?: number
}

const DEFAULT_BASE_URL = 'https://api.strimz.io'

/**
 * Browser-safe Strimz client.
 *
 * Designed for hosted-checkout state polling and the React component
 * family. Read-only on most resources. Refuses a secret key.
 *
 * The `tokens` resource + `selectPaymentPath` / `selectSubscriptionPath`
 * selectors are the core of the capability-detection layer: given a
 * token, the SDK asks the backend which meta-tx flows the token
 * supports, and the selectors map that to a `RelayPath` the checkout
 * UI uses to decide which typed-data to build.
 */
export class StrimzBrowserClient {
  public readonly mode: ApiKeyMode
  /** Read-only access to a session by id (fetched with the publishable key). */
  public readonly paymentSessions: Pick<PaymentSessionsResource, 'retrieve'>
  /** Token metadata + EIP-2612 permit nonce lookup. */
  public readonly tokens: TokensResource

  constructor(options: StrimzBrowserClientOptions) {
    const key = options.publishableKey
    if (!key || typeof key !== 'string') {
      throw new StrimzAuthenticationError(
        { code: 'authentication_error', message: 'publishableKey is required' },
        401,
      )
    }
    if (kindFromKey(key) !== 'publishable') {
      throw new StrimzAuthenticationError(
        {
          code: 'authentication_error',
          message:
            'StrimzBrowserClient must be initialised with a publishable key (pk_test_... / pk_live_...). Never expose secret keys to a browser.',
        },
        401,
      )
    }
    const mode = modeFromKey(key)
    if (mode == null) {
      throw new StrimzAuthenticationError(
        { code: 'authentication_error', message: 'Unrecognised API key prefix' },
        401,
      )
    }
    this.mode = mode

    const fetcher = new Fetcher({
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      baseHeaders: buildBaseHeaders(key, 'browser'),
      timeoutMs: options.timeoutMs,
      maxRetries: 2,
    })
    const sessions = new PaymentSessionsResource({ fetcher })
    this.paymentSessions = { retrieve: sessions.retrieve.bind(sessions) }
    this.tokens = new TokensResource({ fetcher })
  }
}

// Re-export the selectors + path type so consumers don't need a
// second import: `import { StrimzBrowserClient, selectPaymentPath }
// from '@strimz/sdk/browser'`.
export { selectPaymentPath, selectSubscriptionPath, type RelayPath }
