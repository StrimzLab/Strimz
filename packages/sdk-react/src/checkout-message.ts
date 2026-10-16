import { checkoutResultMessageSchema, type CheckoutResultMessage } from '@strimz/shared-types'

export function checkoutOriginOf(checkoutOrigin: string): string {
  return new URL(checkoutOrigin).origin
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

export function checkoutUrl(
  checkoutOrigin: string,
  sessionId: string,
  host: { mode: 'embed' | 'popup'; parentOrigin: string; theme?: string } | null,
): string {
  const url = new URL(`${checkoutOrigin}/pay/${encodeURIComponent(sessionId)}`)
  if (host) {
    url.searchParams.set(host.mode, '1')
    url.searchParams.set('parent', host.parentOrigin)
    if (host.theme) url.searchParams.set('theme', host.theme)
  }
  return url.toString()
}
