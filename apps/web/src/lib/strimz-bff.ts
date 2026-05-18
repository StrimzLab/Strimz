import 'server-only'

import { env } from './env'

/**
 * Strimz API client used by the checkout BFF route handlers.
 *
 * Server-only — uses `STRIMZ_INTERNAL_API_KEY` to call relay
 * endpoints that aren't reachable with a publishable key. Browser
 * code must NEVER import this module (the `'server-only'` guard
 * trips at build time if it does).
 *
 * Kept as a tiny fetch wrapper rather than a full SDK resource —
 * the BFF is just a two-endpoint proxy, and routing through
 * `@strimz/sdk`'s machinery would add no value for that surface
 * area. When the SDK grows a proper `RelayResource` (separate task),
 * migrate this to use it for type-level consistency.
 */

const internalApiKey = process.env.STRIMZ_INTERNAL_API_KEY

interface RelaySubmissionView {
  id: string
  idempotencyKey: string
  status: 'queued' | 'signing' | 'broadcast' | 'confirmed' | 'reverted' | 'failed'
  txHash: string | null
  reason: 'payWithAuthorization' | 'permitAndCreateSubscription'
  errorReason: string | null
  attemptCount: number
  enqueuedAt: string
}

export type { RelaySubmissionView }

interface SubmitPaymentBody {
  idempotencyKey: string
  merchantId: string
  token: `0x${string}`
  auth: {
    from: `0x${string}`
    amount: string
    validAfter: string
    validBefore: string
    nonce: `0x${string}`
  }
  ref: `0x${string}`
  signature: { v: number; r: `0x${string}`; s: `0x${string}` }
  sessionId?: string
}

export async function bffSubmitPayment(body: SubmitPaymentBody): Promise<RelaySubmissionView> {
  return bffPost('/v1/relay/payments', body)
}

interface SubmitSubscriptionBody {
  idempotencyKey: string
  merchantId: string
  token: `0x${string}`
  amount: string
  interval: number
  startAt: string
  endAt: string
  permitData: { owner: `0x${string}`; value: string; deadline: string }
  signature: { v: number; r: `0x${string}`; s: `0x${string}` }
  subscriptionInternalId?: string
}

export async function bffSubmitSubscription(
  body: SubmitSubscriptionBody,
): Promise<RelaySubmissionView> {
  return bffPost('/v1/relay/subscriptions', body)
}

export async function bffGetSubmission(
  idempotencyKey: string,
): Promise<RelaySubmissionView | null> {
  const res = await fetch(
    `${env.apiUrl}/v1/relay/submissions/${encodeURIComponent(idempotencyKey)}`,
    { method: 'GET', headers: authHeaders(), cache: 'no-store' },
  )
  if (res.status === 404) return null
  if (!res.ok) throw await wrapError(res, 'GET /v1/relay/submissions')
  return (await res.json()) as RelaySubmissionView
}

// ---- internal ----

async function bffPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) throw await wrapError(res, `POST ${path}`)
  return (await res.json()) as T
}

function authHeaders(): Record<string, string> {
  if (!internalApiKey) {
    throw new Error(
      'STRIMZ_INTERNAL_API_KEY is not configured — the checkout BFF cannot reach the Strimz API.',
    )
  }
  return { authorization: `Bearer ${internalApiKey}` }
}

/**
 * Surfaces the API's structured error body in a JS Error so route
 * handlers can pass it through to the browser without losing the
 * upstream `code`/`message` shape.
 */
async function wrapError(res: Response, what: string): Promise<Error> {
  let detail: unknown
  try {
    detail = await res.json()
  } catch {
    detail = await res.text().catch(() => '')
  }
  const message =
    detail && typeof detail === 'object' && 'message' in detail
      ? (detail as { message: string }).message
      : `${what} failed with ${res.status}`
  const err = new Error(message) as Error & { status: number; detail: unknown }
  err.status = res.status
  err.detail = detail
  return err
}
