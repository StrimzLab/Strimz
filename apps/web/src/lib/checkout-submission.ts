import { env } from '@/lib/env'

export interface RelaySubmissionView {
  id: string
  idempotencyKey: string
  status: 'queued' | 'signing' | 'broadcast' | 'confirmed' | 'reverted' | 'failed'
  txHash: string | null
  reason: 'payWithAuthorization' | 'permitAndCreateSubscription'
  errorReason: string | null
  attemptCount: number
  enqueuedAt: string
}

export interface CheckoutRelayTarget {
  kind: 'sessions' | 'plans'
  id: string
}

interface ApiErrorBody {
  error?: {
    code?: unknown
    message?: unknown
    details?: { submission?: RelaySubmissionView | null }
  }
}

const LIVE_STATUSES: ReadonlySet<RelaySubmissionView['status']> = new Set([
  'queued',
  'signing',
  'broadcast',
])

const PAYER_MESSAGES: Readonly<Record<string, string>> = {
  insufficient_balance:
    'There is not enough of this token in your wallet to cover the first charge. Add funds and try again.',
  amount_below_minimum:
    'This checkout is below the 1.00 minimum Strimz can process. Ask the merchant for a new link.',
  relay_budget_exhausted:
    'This merchant cannot take more checkouts today. Please try again after 00:00 UTC.',
  rate_limited: 'Too many attempts from your network. Wait a minute and try again.',
  subscription_exists: 'This wallet already subscribes to this plan.',
}

function checkoutPath(target: CheckoutRelayTarget): string {
  return `${env.apiUrl}/v1/checkout/${target.kind}/${encodeURIComponent(target.id)}`
}

export function checkoutSubmissionUrl(target: CheckoutRelayTarget, idempotencyKey: string): string {
  return `${checkoutPath(target)}/submissions/${encodeURIComponent(idempotencyKey)}`
}

export function inProgressSubmission(body: unknown): RelaySubmissionView | null {
  const error = (body as ApiErrorBody | null)?.error
  if (error?.code !== 'attempt_in_progress') return null
  const submission = error.details?.submission
  if (!submission || !LIVE_STATUSES.has(submission.status)) return null
  return submission
}

export function relayErrorMessage(body: unknown, fallback: string): string {
  const error = (body as ApiErrorBody | null)?.error
  const code = typeof error?.code === 'string' ? error.code : null
  const payerMessage = code ? PAYER_MESSAGES[code] : undefined
  if (payerMessage) return payerMessage
  return typeof error?.message === 'string' ? error.message : fallback
}

async function errorBody(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export async function submitCheckoutRelay(
  target: CheckoutRelayTarget,
  body: unknown,
): Promise<RelaySubmissionView> {
  const res = await fetch(`${checkoutPath(target)}/relay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await errorBody(res)
    const live = res.status === 409 ? inProgressSubmission(detail) : null
    if (live) return live
    throw new Error(relayErrorMessage(detail, `submit failed (${res.status})`))
  }
  return (await res.json()) as RelaySubmissionView
}
