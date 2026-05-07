import { describe, it, expect, vi } from 'vitest'
import { Fetcher } from '../src/http/fetcher.js'
import {
  StrimzAuthenticationError,
  StrimzNetworkError,
  StrimzNotFoundError,
  StrimzRateLimitError,
  StrimzTimeoutError,
} from '../src/errors.js'

function jsonRes(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
}

describe('Fetcher', () => {
  it('returns parsed JSON on 2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ id: 'sess_1' }))
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      fetch: fetchMock as unknown as typeof fetch,
    })
    const out = await f.request<{ id: string }>({ method: 'GET', path: '/x' })
    expect(out).toEqual({ id: 'sess_1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws StrimzNotFoundError on 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonRes({ error: { code: 'not_found', message: 'gone' } }, { status: 404 }),
      )
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(f.request({ method: 'GET', path: '/x' })).rejects.toBeInstanceOf(
      StrimzNotFoundError,
    )
  })

  it('throws StrimzAuthenticationError on 401 and does not retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonRes({ error: { code: 'authentication_error', message: 'no' } }, { status: 401 }),
      )
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(f.request({ method: 'GET', path: '/x' })).rejects.toBeInstanceOf(
      StrimzAuthenticationError,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries 5xx for GET and eventually succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonRes({ error: { code: 'api_error', message: 'oops' } }, { status: 503 }),
      )
      .mockResolvedValueOnce(jsonRes({ ok: true }))
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      maxRetries: 3,
      initialBackoffMs: 1,
      fetch: fetchMock as unknown as typeof fetch,
    })
    const out = await f.request<{ ok: boolean }>({ method: 'GET', path: '/x' })
    expect(out).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries 429 and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonRes({ error: { code: 'rate_limited', message: 'slow down' } }, { status: 429 }),
      )
      .mockResolvedValueOnce(jsonRes({ ok: true }))
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      maxRetries: 2,
      initialBackoffMs: 1,
      fetch: fetchMock as unknown as typeof fetch,
    })
    const out = await f.request<{ ok: boolean }>({ method: 'GET', path: '/x' })
    expect(out).toEqual({ ok: true })
  })

  it('does NOT retry 5xx for non-idempotent POST without idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonRes({ error: { code: 'api_error', message: 'oops' } }, { status: 500 }),
      )
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      maxRetries: 3,
      initialBackoffMs: 1,
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(f.request({ method: 'POST', path: '/x', body: {} })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries 5xx for POST with idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonRes({ error: { code: 'api_error', message: 'oops' } }, { status: 502 }),
      )
      .mockResolvedValueOnce(jsonRes({ ok: true }))
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      maxRetries: 2,
      initialBackoffMs: 1,
      fetch: fetchMock as unknown as typeof fetch,
    })
    const out = await f.request<{ ok: boolean }>({
      method: 'POST',
      path: '/x',
      body: {},
      idempotencyKey: 'k_1',
    })
    expect(out).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('classifies network errors as StrimzNetworkError after exhaustion', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      maxRetries: 1,
      initialBackoffMs: 1,
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(f.request({ method: 'GET', path: '/x' })).rejects.toBeInstanceOf(
      StrimzNetworkError,
    )
  })

  it('classifies aborts as StrimzTimeoutError', async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined
        signal?.addEventListener('abort', () => {
          const e = new Error('aborted')
          e.name = 'AbortError'
          reject(e)
        })
      })
    })
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      timeoutMs: 5,
      maxRetries: 0,
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(f.request({ method: 'GET', path: '/x' })).rejects.toBeInstanceOf(
      StrimzTimeoutError,
    )
  })

  it('rate limit error carries retry-after', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonRes(
          { error: { code: 'rate_limited', message: 'no' } },
          { status: 429, headers: { 'Retry-After': '2' } },
        ),
      )
      .mockResolvedValueOnce(
        jsonRes({ error: { code: 'rate_limited', message: 'still no' } }, { status: 429 }),
      )
    const f = new Fetcher({
      baseUrl: 'https://example.test',
      baseHeaders: {},
      maxRetries: 1,
      initialBackoffMs: 1,
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(f.request({ method: 'GET', path: '/x' })).rejects.toBeInstanceOf(
      StrimzRateLimitError,
    )
  })
})
