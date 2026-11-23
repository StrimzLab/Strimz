import { TERMS_VERSION } from '@strimz/shared-config'
import {
  AuthenticationError,
  ForbiddenError,
  MerchantNotSyncedError,
  StrimzApiError,
} from './merchant-api/errors'

const BASE = 'https://strimz.invalid'

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null
  if (
    value.includes('\\') ||
    [...value].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)
  ) {
    return null
  }
  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  return `${url.pathname}${url.search}${url.hash}`
}

export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path
}

export type DashboardGate =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'sync' }
  | { kind: 'onboarding' }
  | { kind: 'terms' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' }

export interface DashboardGateInput {
  privyReady: boolean
  authenticated: boolean
  merchant: {
    isPending: boolean
    error: unknown
    data: { onboardingCompleted: boolean; termsVersion: string | null } | undefined
  }
}

export function dashboardGate({
  privyReady,
  authenticated,
  merchant,
}: DashboardGateInput): DashboardGate {
  if (!privyReady) return { kind: 'loading' }
  if (!authenticated) return { kind: 'login' }
  if (merchant.error instanceof MerchantNotSyncedError) return { kind: 'sync' }
  if (merchant.error instanceof AuthenticationError) return { kind: 'login' }
  if (merchant.error) {
    const message =
      merchant.error instanceof StrimzApiError || merchant.error instanceof Error
        ? merchant.error.message
        : 'Could not load your account'
    return { kind: 'error', message }
  }
  if (merchant.isPending || !merchant.data) return { kind: 'loading' }
  if (!merchant.data.onboardingCompleted) return { kind: 'onboarding' }
  if (merchant.data.termsVersion !== TERMS_VERSION) return { kind: 'terms' }
  return { kind: 'ready' }
}

export type AdminGate<T> =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; admin: T }

export interface AdminGateInput<T> {
  privyReady: boolean
  authenticated: boolean
  me: { isPending: boolean; error: unknown; data: T | undefined }
}

export function adminGate<T>({ privyReady, authenticated, me }: AdminGateInput<T>): AdminGate<T> {
  if (!privyReady) return { kind: 'loading' }
  if (!authenticated) return { kind: 'login' }
  // The sign-in page sends a signed-in visitor straight back, so a redirect here would loop.
  if (me.error instanceof AuthenticationError) {
    return {
      kind: 'error',
      message: "Your sign-in couldn't be confirmed. Sign out, then sign in again.",
    }
  }
  if (me.error instanceof ForbiddenError) return { kind: 'denied' }
  if (me.error) {
    const message = me.error instanceof Error ? me.error.message : 'Could not check admin access'
    return { kind: 'error', message }
  }
  if (me.isPending || !me.data) return { kind: 'loading' }
  return { kind: 'ready', admin: me.data }
}
