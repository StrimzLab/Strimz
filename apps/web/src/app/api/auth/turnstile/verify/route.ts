/**
 * Cloudflare Turnstile server-side verify.
 *
 * Mirrors `apps/api`'s `/v1/auth/turnstile/verify` endpoint but lives in
 * `apps/web` so the signup page is self-contained — no cross-service
 * round-trip, no CORS surface, and signup works before `apps/api` is
 * deployed. The verify is a thin proxy to Cloudflare's Siteverify API
 * that doesn't need the database or any merchant context, so duplicating
 * the call here costs nothing.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Env:
 *   TURNSTILE_SECRET_KEY   server-only, required in prod. When unset,
 *                          every request passes (dev fallback).
 *
 * Body: `{ token: string, action?: string }`
 *
 * - `action`, when supplied, is matched against the verified token's
 *   `action` field. The signup widget renders with `action: 'signup'`,
 *   so the page sends `'signup'` here; tokens minted on a different
 *   surface and replayed against signup will be rejected even if
 *   structurally valid (replay-across-surfaces defense).
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface VerifyBody {
  token?: string
  action?: string
}

interface SiteverifyResponse {
  success?: boolean
  action?: string
  hostname?: string
  'error-codes'?: string[]
}

export async function POST(req: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY

  // Disabled mode — same dev fallback the apps/api adapter uses.
  if (!secret) {
    // eslint-disable-next-line no-console
    console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — bot-protection is disabled.')
    return NextResponse.json({ ok: true, mode: 'disabled' })
  }

  let body: VerifyBody
  try {
    body = (await req.json()) as VerifyBody
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const token = body.token
  const expectedAction = body.action
  if (!token) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 400 })
  }

  // Cloudflare expects the visitor's IP for additional risk scoring.
  // Vercel forwards the original IP via `X-Forwarded-For`; the first
  // hop is the client.
  const remoteIp = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim()

  const form = new URLSearchParams({ secret, response: token })
  if (remoteIp) form.set('remoteip', remoteIp)

  let data: SiteverifyResponse
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    data = (await res.json()) as SiteverifyResponse
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[turnstile] siteverify network error:', err)
    return NextResponse.json({ ok: false, error: 'siteverify_unreachable' }, { status: 502 })
  }

  if (!data.success) {
    // eslint-disable-next-line no-console
    console.warn('[turnstile] rejected:', data['error-codes'])
    return NextResponse.json(
      { ok: false, error: 'verification_failed', codes: data['error-codes'] ?? [] },
      { status: 403 },
    )
  }

  // Action match — see route doc above for replay-defense rationale.
  if (expectedAction && data.action !== expectedAction) {
    // eslint-disable-next-line no-console
    console.warn(`[turnstile] action mismatch: expected="${expectedAction}", got="${data.action}"`)
    return NextResponse.json({ ok: false, error: 'action_mismatch' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
