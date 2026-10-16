import { env } from './env'

const PAYER_REFUSALS: Record<string, string> = {
  payer_already_bound:
    'This checkout is linked to another wallet. Reconnect it, or ask the merchant for a new link.',
  session_not_open: 'This checkout is no longer open. Ask the merchant for a new link.',
  plan_not_active: 'This plan is no longer offered. Ask the merchant for a new link.',
}

interface AttachInput {
  sessionId?: string
  planId?: string
  email: string
  walletAddress: string
}

export function attachSessionPayer(
  input: AttachInput & { sessionId: string },
): Promise<{ customerId: string }> {
  return post(`/v1/checkout/sessions/${encodeURIComponent(input.sessionId)}/payer`, input)
}

export function attachPlanPayer(
  input: AttachInput & { planId: string },
): Promise<{ customerId: string }> {
  return post(`/v1/checkout/plans/${encodeURIComponent(input.planId)}/payer`, input)
}

async function post<T>(path: string, input: AttachInput): Promise<T> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: input.email, walletAddress: input.walletAddress }),
  })
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string }
      message?: string
    }
    const code = detail.error?.code
    const message =
      (code ? PAYER_REFUSALS[code] : undefined) ??
      detail.error?.message ??
      detail.message ??
      `Attach payer failed (${res.status})`
    throw new Error(message)
  }
  return (await res.json()) as T
}
