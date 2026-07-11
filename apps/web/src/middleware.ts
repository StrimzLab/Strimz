import { NextResponse, type NextRequest } from 'next/server'

/**
 * Publish the request pathname as a response header so server
 * components can read it via `headers().get('x-pathname')`.
 *
 * Next.js's `headers()` API only surfaces request headers; the
 * pathname isn't among them. We need it in the root layout so we can
 * refuse to hydrate the payer's stale wagmi cookie state on public
 * hosted-checkout pages (`/pay/*`, `/sub/*`). Otherwise a page reload
 * silently re-attaches whatever wallet the payer last used, and the
 * subscription-submit button routes its `signTypedData` request to
 * that wallet even if the payer wanted to pick a different one this
 * time. See `apps/web/src/components/providers.tsx` for the consumer.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  res.headers.set('x-pathname', req.nextUrl.pathname)
  return res
}

export const config = {
  // Match every route so the header is available everywhere. The
  // matcher intentionally does NOT exclude static/asset paths. We
  // want the header on any App Router segment. Public assets served
  // directly by Next don't hit this at all.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
