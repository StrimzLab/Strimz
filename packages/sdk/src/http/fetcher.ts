/**
 * Fetch wrapper with retry, idempotency, and Strimz error parsing.
 *
 * Retries on:
 *   - Network failures (TypeError on fetch).
 *   - 5xx responses for idempotent methods (GET, POST with idempotency key).
 *   - 429 with Retry-After.
 *
 * Does NOT retry on:
 *   - 4xx other than 429 (caller's bug).
 *   - 5xx for non-idempotent calls without an idempotency key.
 */

import {
  classifyError,
  StrimzError,
  StrimzNetworkError,
  StrimzTimeoutError,
  type StrimzErrorBody,
} from '../errors.js'
import { HEADERS } from './headers.js'

export interface FetcherOptions {
  baseUrl: string
  baseHeaders: Record<string, string>
  /** Default timeout per attempt, milliseconds. */
  timeoutMs?: number
  /** How many retries before giving up. */
  maxRetries?: number
  /** Initial backoff in ms; doubled with jitter on each retry. */
  initialBackoffMs?: number
  /** Optional logger. */
  onRequest?: (info: { method: string; url: string; attempt: number }) => void
  onResponse?: (info: {
    method: string
    url: string
    status: number
    ms: number
    attempt: number
  }) => void
  /** Override the global fetch (for tests or Edge polyfills). */
  fetch?: typeof globalThis.fetch
}

export interface RequestSpec {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  idempotencyKey?: string
  /** Per-call timeout override. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_INITIAL_BACKOFF_MS = 250

export class Fetcher {
  private readonly baseUrl: string
  private readonly baseHeaders: Record<string, string>
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly initialBackoffMs: number
  private readonly onRequest: FetcherOptions['onRequest']
  private readonly onResponse: FetcherOptions['onResponse']
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(opts: FetcherOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.baseHeaders = opts.baseHeaders
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
    this.initialBackoffMs = opts.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS
    this.onRequest = opts.onRequest
    this.onResponse = opts.onResponse
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async request<T>(spec: RequestSpec): Promise<T> {
    const url = this.buildUrl(spec.path, spec.query)
    const idempotent = isIdempotent(spec)
    const headers: Record<string, string> = { ...this.baseHeaders }
    if (spec.body != null) headers['Content-Type'] = 'application/json'
    if (spec.idempotencyKey) headers[HEADERS.idempotencyKey] = spec.idempotencyKey

    let attempt = 0
    let lastErr: unknown
    while (attempt <= this.maxRetries) {
      try {
        this.onRequest?.({ method: spec.method, url, attempt })
        const start = Date.now()
        const res = await this.fetchWithTimeout(
          url,
          {
            method: spec.method,
            headers,
            body: spec.body == null ? undefined : JSON.stringify(spec.body),
          },
          spec.timeoutMs ?? this.timeoutMs,
        )
        const ms = Date.now() - start
        this.onResponse?.({ method: spec.method, url, status: res.status, ms, attempt })

        if (res.ok) {
          if (res.status === 204) return undefined as T
          return (await res.json()) as T
        }

        const errorBody = await parseErrorBody(res)
        const retryAfterMs = parseRetryAfter(res)

        // 429. Back off and retry up to maxRetries.
        if (res.status === 429 && attempt < this.maxRetries) {
          await delay(retryAfterMs ?? this.backoffFor(attempt))
          attempt++
          continue
        }
        // 5xx. Retry only if idempotent.
        if (res.status >= 500 && idempotent && attempt < this.maxRetries) {
          await delay(this.backoffFor(attempt))
          attempt++
          continue
        }

        throw classifyError(res.status, errorBody, retryAfterMs)
      } catch (err) {
        if (err instanceof StrimzError) throw err
        lastErr = err
        if (!isNetworkLike(err) || attempt >= this.maxRetries) {
          if (err instanceof StrimzTimeoutError) throw err
          throw new StrimzNetworkError(`Network error: ${describe(err)}`, err)
        }
        await delay(this.backoffFor(attempt))
        attempt++
      }
    }
    throw new StrimzNetworkError(`Network error after ${this.maxRetries} retries`, lastErr)
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal })
    } catch (err) {
      if (isAbortError(err)) {
        throw new StrimzTimeoutError(`Request timed out after ${timeoutMs}ms`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private buildUrl(path: string, query?: RequestSpec['query']): string {
    const base = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    if (!query) return base
    const usp = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue
      usp.append(k, String(v))
    }
    const qs = usp.toString()
    return qs ? `${base}?${qs}` : base
  }

  private backoffFor(attempt: number): number {
    const expo = this.initialBackoffMs * Math.pow(2, attempt)
    const jitter = Math.random() * this.initialBackoffMs
    return Math.min(expo + jitter, 8_000)
  }
}

function isIdempotent(spec: RequestSpec): boolean {
  if (spec.method === 'GET' || spec.method === 'DELETE') return true
  return spec.idempotencyKey != null
}

async function parseErrorBody(res: Response): Promise<StrimzErrorBody> {
  try {
    const json = (await res.json()) as { error?: StrimzErrorBody } | StrimzErrorBody
    if (typeof json === 'object' && json !== null && 'error' in json && json.error) {
      return json.error
    }
    if (typeof json === 'object' && json !== null && 'code' in json && 'message' in json) {
      return json as StrimzErrorBody
    }
  } catch {
    // fall through
  }
  return { code: 'api_error', message: `HTTP ${res.status}` }
}

function parseRetryAfter(res: Response): number | undefined {
  const v = res.headers.get('Retry-After')
  if (!v) return undefined
  const n = Number(v)
  if (Number.isFinite(n)) return Math.max(0, n) * 1_000
  const date = Date.parse(v)
  if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  return undefined
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function isNetworkLike(err: unknown): boolean {
  if (err instanceof TypeError) return true // fetch network failures
  if (err instanceof Error && /fetch|network|econn/i.test(err.message)) return true
  return false
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
