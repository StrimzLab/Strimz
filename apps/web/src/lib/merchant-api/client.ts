import { env } from '@/lib/env'
import { type AccessTokenProvider, defaultAccessTokenProvider } from './auth-token'
import { buildApiError, type ApiErrorBody, AuthenticationError } from './errors'

/**
 * Thin typed fetch wrapper for the merchant dashboard.
 *
 * Why a custom client rather than the @strimz/sdk StrimzClient:
 *   - StrimzClient is built for backend integrations (secret-key auth,
 *     module-scope construction, no React hooks).
 *   - The dashboard is browser-side, authenticated with a Privy access
 *     token that *expires every hour*. Tying request-time auth to a
 *     React-scoped function (Privy's `getAccessToken`) needs a
 *     per-request token lookup — exactly what this client does.
 *   - We want typed error subclasses, not opaque thrown objects, so
 *     hooks/components can branch on intent without parsing codes.
 *
 * The client is constructed once per app boot (see `useMerchantApi`)
 * and used by every TanStack Query hook. It does NOT cache responses —
 * caching is TanStack Query's job; the client only does I/O + typing.
 */
export interface MerchantApiClientOptions {
  /** Base URL for apps/api. Defaults to `env.apiUrl`. */
  baseUrl?: string
  /** Token provider override (tests / Playwright stubs). */
  getAccessToken?: AccessTokenProvider
  /** Per-request fetch timeout. Defaults to 30s. */
  defaultTimeoutMs?: number
}

export interface RequestOptions {
  /** Override the default request timeout for slow operations (e.g. exports). */
  timeoutMs?: number
  /** Pre-built `AbortSignal` for cancellation — TanStack Query passes one in. */
  signal?: AbortSignal
  /** Query-string params, serialised with stable ordering. */
  query?: Record<string, string | number | boolean | undefined | null>
  /** JSON body for POST/PATCH/PUT. */
  body?: unknown
  /**
   * When true, the client skips the access-token lookup. Used for the
   * `/v1/auth/sync` endpoint (which carries the Privy token explicitly
   * in its body) and for any genuinely public endpoint. Defaults to
   * false — the safe default is "this needs auth".
   */
  skipAuth?: boolean
}

export class MerchantApiClient {
  readonly baseUrl: string
  private readonly getAccessToken: AccessTokenProvider
  private readonly defaultTimeoutMs: number

  constructor(opts: MerchantApiClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? env.apiUrl).replace(/\/+$/, '')
    this.getAccessToken = opts.getAccessToken ?? defaultAccessTokenProvider
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 30_000
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, options)
  }

  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...options, body })
  }

  patch<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body })
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options)
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query)

    const headers: HeadersInit = {
      accept: 'application/json',
    }

    if (!options.skipAuth) {
      const token = await this.getAccessToken()
      if (!token) {
        // We could let the API return 401 itself, but failing fast
        // here avoids a network round-trip and gives the hook a clear
        // signal to redirect the user to /login.
        throw new AuthenticationError({
          code: 'authentication_error',
          message: 'no Privy access token available — sign in to continue',
        })
      }
      ;(headers as Record<string, string>).authorization = `Bearer ${token}`
    }

    let bodyJson: string | undefined
    if (options.body !== undefined) {
      bodyJson = JSON.stringify(options.body)
      ;(headers as Record<string, string>)['content-type'] = 'application/json'
    }

    // Compose the caller's AbortSignal (TanStack Query supplies one) with
    // our own timeout signal. Either firing aborts the fetch. We avoid
    // `AbortSignal.any` for older runtime parity by wiring a small
    // adapter — Safari < 17 doesn't ship `any` yet.
    const controller = new AbortController()
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs
    const timeout = setTimeout(
      () => controller.abort(new DOMException('timeout', 'AbortError')),
      timeoutMs,
    )
    const onUpstreamAbort = () => controller.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', onUpstreamAbort, { once: true })

    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: bodyJson,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onUpstreamAbort)
    }

    if (response.status === 204) return undefined as T

    const isJson = response.headers.get('content-type')?.includes('application/json')

    if (!response.ok) {
      const body: ApiErrorBody = isJson
        ? await response.json().catch(() => ({
            code: 'unknown_error',
            message: `request failed with status ${response.status}`,
          }))
        : {
            code: 'unknown_error',
            message: `request failed with status ${response.status}`,
          }
      throw buildApiError(response.status, body, response.headers)
    }

    if (!isJson) {
      // Defensive: we only call JSON endpoints. A non-JSON 2xx means
      // either the API contract changed or we hit a misrouted CDN —
      // raising explicitly beats handing the caller `undefined`.
      throw new Error(
        `expected JSON response, got ${response.headers.get('content-type') ?? 'unknown'}`,
      )
    }

    return (await response.json()) as T
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, this.baseUrl)
    if (query) {
      // Stable ordering so the same query produces the same URL on
      // repeat calls — helps with TanStack Query's request dedup and
      // makes server-side logs easier to diff across replays.
      for (const key of Object.keys(query).sort()) {
        const value = query[key]
        if (value === undefined || value === null) continue
        url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }
}
