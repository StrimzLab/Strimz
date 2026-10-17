import type { TestApp } from './test-app.factory.js'

type InjectMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** A `fetch` that sends SDK requests to the test app, so the SDK parses real API responses. */
export function injectFetch(t: TestApp): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString())
    const res = await t.inject({
      method: (init?.method ?? 'GET') as InjectMethod,
      url: url.pathname + url.search,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      ...(typeof init?.body === 'string' ? { payload: init.body } : {}),
    })
    const headers = new Headers()
    for (const [name, value] of Object.entries(res.headers)) {
      if (value !== undefined) headers.set(name, String(value))
    }
    return new Response(res.body, { status: res.statusCode, headers })
  }) as typeof fetch
}
