import {
  checkoutResultMessageSchema,
  subscriptionResultMessageSchema,
  type CheckoutResultMessage,
  type SubscriptionResultMessage,
} from '@strimz/shared-types'

export const DEFAULT_CHECKOUT_ORIGIN = 'https://www.strimz.finance'

export function checkoutOriginOf(checkoutOrigin: string): string {
  let url: URL
  try {
    url = new URL(checkoutOrigin)
  } catch {
    throw new Error(
      `checkoutOrigin must be an origin like ${DEFAULT_CHECKOUT_ORIGIN}, got "${checkoutOrigin}".`,
    )
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      `checkoutOrigin must be an origin with no path, query or hash, like ${DEFAULT_CHECKOUT_ORIGIN}. Got "${checkoutOrigin}".`,
    )
  }
  return url.origin
}

export function readCheckoutResult(
  ev: MessageEvent,
  expected: { origin: string; source: MessageEventSource | null; sessionId: string | null },
): CheckoutResultMessage | null {
  if (ev.origin !== expected.origin) return null
  if (!expected.source || ev.source !== expected.source) return null
  const parsed = checkoutResultMessageSchema.safeParse(ev.data)
  if (!parsed.success || parsed.data.sessionId !== expected.sessionId) return null
  return parsed.data
}

export interface CheckoutHostParams {
  mode: 'embed' | 'popup'
  parentOrigin: string
  theme?: string
}

export function checkoutUrl(
  checkoutOrigin: string,
  sessionId: string,
  host: CheckoutHostParams | null,
): string {
  return hostedUrl(checkoutOrigin, `/pay/${encodeURIComponent(sessionId)}`, host)
}

export function subscriptionUrl(
  checkoutOrigin: string,
  planId: string,
  host: CheckoutHostParams | null,
): string {
  return hostedUrl(checkoutOrigin, `/sub/${encodeURIComponent(planId)}`, host)
}

export function readSubscriptionResult(
  ev: MessageEvent,
  expected: { origin: string; source: MessageEventSource | null; planId: string | null },
): SubscriptionResultMessage | null {
  if (ev.origin !== expected.origin) return null
  if (!expected.source || ev.source !== expected.source) return null
  const parsed = subscriptionResultMessageSchema.safeParse(ev.data)
  if (!parsed.success || parsed.data.planId !== expected.planId) return null
  return parsed.data
}

function hostedUrl(checkoutOrigin: string, path: string, host: CheckoutHostParams | null): string {
  const url = new URL(`${checkoutOrigin}${path}`)
  if (host) {
    url.searchParams.set(host.mode, '1')
    url.searchParams.set('parent', host.parentOrigin)
    if (host.theme) url.searchParams.set('theme', host.theme)
  }
  return url.toString()
}
