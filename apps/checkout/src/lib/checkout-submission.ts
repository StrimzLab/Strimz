import { env } from '@strimz/web-shared/lib/env'
import { PAYER_MESSAGES } from '@/lib/payer-errors'

export interface RelaySubmissionView {
  id: string
  idempotencyKey: string
  status: 'queued' | 'signing' | 'broadcast' | 'confirmed' | 'reverted' | 'failed'
  txHash: string | null
  reason:
    | 'payWithAuthorization'
    | 'permitAndCreateSubscription'
    | 'permitAllowance'
    | 'cancelWithSig'
  errorReason: string | null
  attemptCount: number
  enqueuedAt: string
}

/** The payer-signed call, which the payer's own wallet can send when Strimz won't pay the gas. */
export interface SelfPayCall {
  to: `0x${string}`
  data: `0x${string}`
  chainId: number
}

export class RelayUnavailableError extends Error {
  constructor(
    readonly reason: string,
    readonly call: SelfPayCall,
  ) {
    super("Strimz can't cover the network fee for this one.")
    this.name = 'RelayUnavailableError'
  }
}

export interface CheckoutRelayTarget {
  kind: 'sessions' | 'plans' | 'subscriptions'
  id: string
}

interface ApiErrorBody {
  error?: {
    code?: unknown
    message?: unknown
    details?: { submission?: RelaySubmissionView | null; reason?: unknown; call?: unknown }
  }
}

const LIVE_STATUSES: ReadonlySet<RelaySubmissionView['status']> = new Set([
  'queued',
  'signing',
  'broadcast',
])

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

/** A 402 `relay_unavailable` as a typed error, or null for any other response. */
export function relayUnavailableFrom(status: number, body: unknown): RelayUnavailableError | null {
  if (status !== 402) return null
  const selfPay = selfPayCallOf(body)
  return selfPay ? new RelayUnavailableError(selfPay.reason, selfPay.call) : null
}

function selfPayCallOf(body: unknown): { reason: string; call: SelfPayCall } | null {
  const error = (body as ApiErrorBody | null)?.error
  if (error?.code !== 'relay_unavailable') return null
  const call = error.details?.call as Partial<SelfPayCall> | undefined
  const hex = (v: unknown, len?: number): v is `0x${string}` =>
    typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v) && (len === undefined || v.length === len)
  if (!call || !hex(call.to, 42) || !hex(call.data) || !Number.isInteger(call.chainId)) return null
  const reason = typeof error.details?.reason === 'string' ? error.details.reason : 'unavailable'
  return { reason, call: { to: call.to, data: call.data, chainId: call.chainId as number } }
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
  action: 'relay' | 'allowance' = 'relay',
): Promise<RelaySubmissionView> {
  const res = await fetch(`${checkoutPath(target)}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await errorBody(res)
    const live = res.status === 409 ? inProgressSubmission(detail) : null
    if (live) return live
    const unavailable = relayUnavailableFrom(res.status, detail)
    if (unavailable) throw unavailable
    throw new Error(relayErrorMessage(detail, `submit failed (${res.status})`))
  }
  return (await res.json()) as RelaySubmissionView
}
