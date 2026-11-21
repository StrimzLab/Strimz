import { env } from '@strimz/web-shared/lib/env'

import type { RelaySubmissionView } from '@/lib/checkout-submission'

export interface ManagedSubscription {
  subscriptionId: string
  onchainSubscriptionId: number
  merchantName: string | null
  planName: string
  amount: string
  currency: 'USDC' | 'EURC'
  status: 'trialing' | 'active' | 'at_risk'
  nextChargeAt: string | null
  currentPeriodEndAt: string
}

export interface ManagedSubscriptionsView {
  chainId: number
  subscriptionsAddress: `0x${string}`
  data: ManagedSubscription[]
}

const MESSAGES: Readonly<Record<string, string>> = {
  invalid_signature:
    "That signature doesn't match this wallet. Try again from the wallet that subscribed.",
  signature_expired: 'That signature has expired. Sign again to continue.',
  subscription_not_active: 'This subscription has already ended.',
  rate_limited: 'Too many attempts from your network. Wait a minute and try again.',
  not_found: "We couldn't find that subscription.",
}

async function post<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(`${env.apiUrl}/v1/checkout/manage/subscriptions${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.ok) return (await res.json()) as T
  let code: string | null = null
  try {
    const parsed = (await res.json()) as { error?: { code?: unknown } }
    code = typeof parsed.error?.code === 'string' ? parsed.error.code : null
  } catch {
    code = null
  }
  throw new Error((code && MESSAGES[code]) ?? fallback)
}

export function listManagedSubscriptions(input: {
  payer: `0x${string}`
  issuedAt: bigint
  signature: `0x${string}`
}): Promise<ManagedSubscriptionsView> {
  return post(
    '',
    { payer: input.payer, issuedAt: input.issuedAt.toString(), signature: input.signature },
    "We couldn't load your subscriptions. Try again.",
  )
}

export function cancelManagedSubscription(
  subscriptionId: string,
  input: { deadline: bigint; signature: `0x${string}` },
): Promise<RelaySubmissionView> {
  return post(
    `/${encodeURIComponent(subscriptionId)}/cancel`,
    { deadline: input.deadline.toString(), signature: input.signature },
    "We couldn't cancel this subscription. Try again.",
  )
}

export interface ManageState {
  phase: 'signin' | 'loading' | 'list' | 'empty'
  view: ManagedSubscriptionsView | null
  subscriptions: ManagedSubscription[]
  cancelling: string | null
  cancelled: string[]
  error: string | null
}

export type ManageAction =
  | { type: 'signing_in' }
  | { type: 'loaded'; view: ManagedSubscriptionsView }
  | { type: 'load_failed'; message: string }
  | { type: 'cancel_started'; subscriptionId: string }
  | { type: 'cancel_confirmed'; subscriptionId: string }
  | { type: 'cancel_failed'; message: string }
  | { type: 'reset' }

export const initialManageState: ManageState = {
  phase: 'signin',
  view: null,
  subscriptions: [],
  cancelling: null,
  cancelled: [],
  error: null,
}

export function manageReducer(state: ManageState, action: ManageAction): ManageState {
  switch (action.type) {
    case 'signing_in':
      return { ...state, phase: 'loading', error: null }
    case 'loaded':
      return {
        ...state,
        phase: action.view.data.length > 0 ? 'list' : 'empty',
        view: action.view,
        subscriptions: action.view.data,
        error: null,
      }
    case 'load_failed':
      return { ...state, phase: 'signin', error: action.message }
    case 'cancel_started':
      return { ...state, cancelling: action.subscriptionId, error: null }
    case 'cancel_confirmed':
      return {
        ...state,
        cancelling: null,
        cancelled: [...state.cancelled, action.subscriptionId],
      }
    case 'cancel_failed':
      return { ...state, cancelling: null, error: action.message }
    case 'reset':
      return initialManageState
  }
}
