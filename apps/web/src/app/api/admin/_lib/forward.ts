import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { env } from '@/lib/env'

/**
 * Shared BFF forwarding helper for `/api/admin/*` route handlers.
 *
 * What this enforces server-side:
 *
 *   1. **CSRF / origin gate.** A cross-site form post would arrive with
 *      an Origin/Referer mismatched to our own. We reject anything
 *      whose Origin isn't an allowlisted Strimz origin. The browser
 *      `fetch` from inside the admin client always sets Origin so
 *      legitimate calls pass.
 *
 *   2. **Bearer extraction.** The admin client sends the Privy token in
 *      the browser fetch (cookies in a same-origin fetch don't include
 *      Privy state). The route reads the Authorization header.
 *
 *   3. **Server-side audit context.** We surface the client IP +
 *      user-agent + admin id (resolved server-side later) on the
 *      forwarded request so apps/api's audit log can attribute the
 *      action precisely. We could ALSO inject internal credentials
 *      (a future Strimz internal service key) without touching the
 *      browser bundle.
 *
 *   4. **Single hop.** No retries, no client-side cache. Errors
 *      propagate straight through.
 */

const ALLOWED_ORIGINS = new Set([
  env.appUrl, // localhost:3000 in dev, the deploy URL in prod
  'https://strimz-finance.vercel.app',
  'https://strimz.finance',
])

interface ForwardOptions {
  method: 'POST' | 'PATCH' | 'DELETE'
  /** Path on apps/api, e.g. `/v1/admin/merchants/abc/suspend`. */
  upstreamPath: string
  /** Body forwarded verbatim. Omit for empty body. */
  body?: unknown
}

export async function forwardAdminWrite(req: Request, opts: ForwardOptions): Promise<Response> {
  // 1. Origin gate.
  const origin = req.headers.get('origin')
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json(
      { code: 'csrf_origin_mismatch', message: 'cross-origin admin write rejected' },
      { status: 403 },
    )
  }

  // 2. Bearer extraction.
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return NextResponse.json(
      { code: 'authentication_error', message: 'missing bearer token' },
      { status: 401 },
    )
  }

  // 3. Audit context. The client IP and user-agent are surfaced via
  // forwarded headers; apps/api reads them when writing the audit log.
  const reqHeaders = await headers()
  const fwdHeaders: HeadersInit = {
    authorization: auth,
    accept: 'application/json',
    'x-forwarded-for': reqHeaders.get('x-forwarded-for') ?? '',
    'x-forwarded-user-agent': reqHeaders.get('user-agent') ?? '',
  }

  let bodyText: string | undefined
  if (opts.body !== undefined) {
    bodyText = JSON.stringify(opts.body)
    fwdHeaders['content-type'] = 'application/json'
  }

  const upstream = new URL(opts.upstreamPath, env.apiUrl).toString()
  const res = await fetch(upstream, {
    method: opts.method,
    headers: fwdHeaders,
    body: bodyText,
  })

  // Pipe through. Preserve status + JSON body.
  const text = await res.text()
  return new Response(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
    },
  })
}

/**
 * Helper to read a JSON body from a Next.js `Request` defensively. The
 * client-side admin client always sends JSON, but a stray empty body
 * shouldn't fail the BFF.
 */
export async function readJsonBody(req: Request): Promise<unknown> {
  const text = await req.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}
