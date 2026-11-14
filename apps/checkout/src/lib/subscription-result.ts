import {
  subscriptionResultMessageSchema,
  type SubscriptionResultErrorCode,
  type SubscriptionResultMessage,
  type SubscriptionStatusResult,
} from '@strimz/shared-types'
import type { CheckoutHost, HostWindows } from '@/lib/checkout-result'

const SUBSCRIPTION_ID_PLACEHOLDER = '{SUBSCRIPTION_ID}'
const TX_HASH_PLACEHOLDER = '{ON_CHAIN_TX_HASH}'
const MAX_MESSAGE_LENGTH = 500

export function buildSubscriptionReturnUrl(
  template: string,
  values: { subscriptionId: string | null; txHash: string | null },
): string {
  return template
    .replaceAll(SUBSCRIPTION_ID_PLACEHOLDER, encodeURIComponent(values.subscriptionId ?? ''))
    .replaceAll(TX_HASH_PLACEHOLDER, encodeURIComponent(values.txHash ?? ''))
}

export function postSubscriptionResult(
  host: CheckoutHost,
  message: unknown,
  windows: HostWindows,
): void {
  const parsed = subscriptionResultMessageSchema.parse(message)
  if (!host.parentOrigin) return
  const target =
    host.mode === 'embed' ? windows.parent : host.mode === 'popup' ? windows.opener : null
  target?.postMessage(parsed, host.parentOrigin)
}

export type SubscriptionResultPhase =
  | 'loading'
  | 'load_error'
  | 'not_ready'
  | 'connect'
  | 'ready'
  | 'already_subscribed'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

const ERROR_CODE_FOR_PHASE: Partial<Record<SubscriptionResultPhase, SubscriptionResultErrorCode>> =
  {
    load_error: 'load_failed',
    not_ready: 'merchant_not_ready',
    reverted: 'payment_reverted',
    already_subscribed: 'already_subscribed',
  }

const DEFAULT_ERROR_MESSAGE: Record<SubscriptionResultErrorCode, string> = {
  load_failed: 'The checkout could not load this plan.',
  merchant_not_ready: 'This merchant cannot take subscriptions yet.',
  payment_reverted: 'The subscription was rejected on-chain.',
  already_subscribed: 'This wallet already subscribes to this plan.',
}

/** `subscriptionId` is `undefined` while the lookup after confirmation runs. */
export function subscriptionResultForPhase(args: {
  phase: SubscriptionResultPhase
  planId: string
  txHash: string | null
  subscriptionId: string | null | undefined
  error: string | null
}): SubscriptionResultMessage | null {
  const { phase, planId, txHash, subscriptionId, error } = args
  if (phase === 'confirmed') {
    if (!txHash || subscriptionId === undefined) return null
    return { type: 'strimz:subscription:success', planId, subscriptionId, txHash }
  }
  const code = ERROR_CODE_FOR_PHASE[phase]
  if (!code) return null
  const message = (error ?? DEFAULT_ERROR_MESSAGE[code]).slice(0, MAX_MESSAGE_LENGTH)
  return { type: 'strimz:subscription:error', planId, code, message }
}

export function subscriptionCancelDestination(
  host: CheckoutHost,
  cancelUrl: string | null,
): string | null {
  if (host.mode !== 'page' || !cancelUrl) return null
  return buildSubscriptionReturnUrl(cancelUrl, { subscriptionId: null, txHash: null })
}

/**
 * The indexer creates the subscription a few seconds after the relay
 * confirms. Null after the timeout; the merchant still has the tx hash
 * and the webhook.
 */
export async function waitForSubscriptionId(
  status: () => Promise<SubscriptionStatusResult>,
  opts: {
    intervalMs: number
    timeoutMs: number
    now?: () => number
    sleep?: (ms: number) => Promise<void>
  },
): Promise<string | null> {
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const deadline = now() + opts.timeoutMs
  while (now() < deadline) {
    const result = await status().catch((err: unknown) => {
      console.warn('[checkout] subscription lookup failed', err)
      return null
    })
    if (result?.subscriptionId) return result.subscriptionId
    await sleep(opts.intervalMs)
  }
  return null
}
