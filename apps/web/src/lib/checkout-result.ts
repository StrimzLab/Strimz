import {
  checkoutResultMessageSchema,
  type CheckoutResultErrorCode,
  type CheckoutResultMessage,
} from '@strimz/shared-types'
import { EMBED_QUERY_PARAM, isEmbedded } from '@/lib/theme'

export const POPUP_QUERY_PARAM = 'popup'
export const PARENT_QUERY_PARAM = 'parent'

export type CheckoutHostMode = 'page' | 'embed' | 'popup'

export interface CheckoutHost {
  mode: CheckoutHostMode
  parentOrigin: string | null
}

interface QueryReader {
  get(name: string): string | null
}

interface MessageTarget {
  postMessage(message: unknown, targetOrigin: string): void
}

export interface HostWindows {
  parent: MessageTarget | null
  opener: MessageTarget | null
}

const SESSION_ID_PLACEHOLDER = '{CHECKOUT_SESSION_ID}'
const TX_HASH_PLACEHOLDER = '{ON_CHAIN_TX_HASH}'
const MAX_MESSAGE_LENGTH = 500
const EIP7702_DELEGATION = /^0xef0100[0-9a-f]{40}$/iu

export function buildReturnUrl(
  template: string,
  values: { sessionId: string; txHash: string | null },
): string {
  return template
    .replaceAll(SESSION_ID_PLACEHOLDER, encodeURIComponent(values.sessionId))
    .replaceAll(TX_HASH_PLACEHOLDER, encodeURIComponent(values.txHash ?? ''))
}

export function resolveParentOrigin(raw: string | null | undefined): string | null {
  if (!raw || !URL.canParse(raw)) return null
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return url.origin === raw ? url.origin : null
}

export function resolveCheckoutHost(query: QueryReader): CheckoutHost {
  const mode: CheckoutHostMode = isEmbedded(query.get(EMBED_QUERY_PARAM))
    ? 'embed'
    : query.get(POPUP_QUERY_PARAM) === '1'
      ? 'popup'
      : 'page'
  if (mode === 'page') return { mode, parentOrigin: null }
  return { mode, parentOrigin: resolveParentOrigin(query.get(PARENT_QUERY_PARAM)) }
}

export function postCheckoutResult(
  host: CheckoutHost,
  message: unknown,
  windows: HostWindows,
): void {
  const parsed = checkoutResultMessageSchema.parse(message)
  if (!host.parentOrigin) return
  const target =
    host.mode === 'embed' ? windows.parent : host.mode === 'popup' ? windows.opener : null
  target?.postMessage(parsed, host.parentOrigin)
}

export type ResultPhase =
  | 'loading'
  | 'load_error'
  | 'not_ready'
  | 'unsupported_wallet'
  | 'connect'
  | 'ready'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

const ERROR_CODE_FOR_PHASE: Partial<Record<ResultPhase, CheckoutResultErrorCode>> = {
  load_error: 'load_failed',
  not_ready: 'merchant_not_ready',
  reverted: 'payment_reverted',
  unsupported_wallet: 'unsupported_wallet',
}

const DEFAULT_ERROR_MESSAGE: Record<CheckoutResultErrorCode, string> = {
  load_failed: 'The checkout could not load this payment.',
  merchant_not_ready: 'This merchant cannot take payments yet.',
  payment_reverted: 'The payment was rejected on-chain.',
  unsupported_wallet: 'Smart-contract wallets cannot pay here yet.',
}

export function resultMessageForPhase(args: {
  phase: ResultPhase
  sessionId: string
  txHash: string | null
  error: string | null
}): CheckoutResultMessage | null {
  const { phase, sessionId, txHash, error } = args
  if (phase === 'confirmed') {
    return txHash ? { type: 'strimz:checkout:success', sessionId, txHash } : null
  }
  const code = ERROR_CODE_FOR_PHASE[phase]
  if (!code) return null
  const message = (error ?? DEFAULT_ERROR_MESSAGE[code]).slice(0, MAX_MESSAGE_LENGTH)
  return { type: 'strimz:checkout:error', sessionId, code, message }
}

export function cancelDestination(
  host: CheckoutHost,
  cancelUrl: string | null,
  sessionId: string,
): string | null {
  if (host.mode !== 'page' || !cancelUrl) return null
  return buildReturnUrl(cancelUrl, { sessionId, txHash: null })
}

export function isContractAccount(code: string | null | undefined): boolean {
  if (!code || code === '0x') return false
  return !EIP7702_DELEGATION.test(code)
}

const PAYMENT_IN_FLIGHT = new Set(['signing', 'submitting', 'polling', 'confirmed'])

export function isCancellable(phase: string): boolean {
  return !PAYMENT_IN_FLIGHT.has(phase)
}
