import { TERMS_VERSION } from '@strimz/shared-config'
import { describe, expect, it } from 'vitest'

import {
  adminGate,
  dashboardGate,
  safeNextPath,
  type AdminGateInput,
  type DashboardGateInput,
} from '../auth-redirect'
import {
  AuthenticationError,
  ForbiddenError,
  MerchantNotSyncedError,
  StrimzApiError,
} from '../merchant-api/errors'

describe('safeNextPath', () => {
  it.each(['/app', '/app/invoices', '/admin/merchants?tier=enterprise', '/app#keys'])(
    'keeps the same-site path %s',
    (path) => {
      expect(safeNextPath(path)).toBe(path)
    },
  )

  it.each([
    'https://evil.test/app',
    '//evil.test',
    '/\\evil.test',
    '\\\\evil.test',
    'javascript:alert(1)',
    'app/invoices',
    '',
    '/app\n',
    null,
    undefined,
    42,
  ])('refuses %j', (value) => {
    expect(safeNextPath(value)).toBeNull()
  })
})

const synced = { onboardingCompleted: true, termsVersion: TERMS_VERSION }
const unsynced = new MerchantNotSyncedError({ code: 'merchant_not_synced', message: 'sync first' })
const expired = new AuthenticationError({ code: 'authentication_error', message: 'expired' })
const broken = new StrimzApiError(500, { code: 'api_error', message: 'boom' })

describe('dashboardGate', () => {
  const merchant = (
    over: Partial<DashboardGateInput['merchant']>,
  ): DashboardGateInput['merchant'] => ({
    isPending: false,
    error: null,
    data: undefined,
    ...over,
  })

  it('waits while Privy hydrates', () => {
    expect(
      dashboardGate({ privyReady: false, authenticated: false, merchant: merchant({}) }),
    ).toEqual({
      kind: 'loading',
    })
  })

  it('sends a signed-out visitor to login', () => {
    expect(
      dashboardGate({
        privyReady: true,
        authenticated: false,
        merchant: merchant({ isPending: true }),
      }),
    ).toEqual({ kind: 'login' })
  })

  it('sends a session the API no longer accepts to login', () => {
    expect(
      dashboardGate({
        privyReady: true,
        authenticated: true,
        merchant: merchant({ error: expired }),
      }),
    ).toEqual({ kind: 'login' })
  })

  it('sends a signed-in user without a merchant record to sync', () => {
    expect(
      dashboardGate({
        privyReady: true,
        authenticated: true,
        merchant: merchant({ error: unsynced }),
      }),
    ).toEqual({ kind: 'sync' })
  })

  it('reports any other failure with its message', () => {
    expect(
      dashboardGate({
        privyReady: true,
        authenticated: true,
        merchant: merchant({ error: broken }),
      }),
    ).toEqual({ kind: 'error', message: 'boom' })
  })

  it('waits while the merchant loads', () => {
    expect(
      dashboardGate({
        privyReady: true,
        authenticated: true,
        merchant: merchant({ isPending: true }),
      }),
    ).toEqual({ kind: 'loading' })
  })

  it.each([
    ['older terms', '2020-01-01'],
    ['no terms yet', null],
  ])('asks an onboarded merchant on %s to accept the current terms', (_label, termsVersion) => {
    expect(
      dashboardGate({
        privyReady: true,
        authenticated: true,
        merchant: merchant({ data: { onboardingCompleted: true, termsVersion } }),
      }),
    ).toEqual({ kind: 'terms' })
  })

  it('sends a merchant who has not finished onboarding to onboarding', () => {
    expect(
      dashboardGate({
        privyReady: true,
        authenticated: true,
        merchant: merchant({ data: { onboardingCompleted: false, termsVersion: null } }),
      }),
    ).toEqual({ kind: 'onboarding' })
  })

  it('shows the dashboard to a synced, onboarded merchant', () => {
    expect(
      dashboardGate({
        privyReady: true,
        authenticated: true,
        merchant: merchant({ data: synced }),
      }),
    ).toEqual({ kind: 'ready' })
  })
})

describe('adminGate', () => {
  const me = (
    over: Partial<AdminGateInput<{ id: string }>['me']>,
  ): AdminGateInput<{ id: string }>['me'] => ({
    isPending: false,
    error: null,
    data: undefined,
    ...over,
  })
  const denied = new ForbiddenError({
    code: 'admin_access_denied',
    message: 'no admin profile for this account',
  })

  it('waits while Privy hydrates', () => {
    expect(adminGate({ privyReady: false, authenticated: false, me: me({}) })).toEqual({
      kind: 'loading',
    })
  })

  it('sends a signed-out visitor to the admin sign-in', () => {
    expect(adminGate({ privyReady: true, authenticated: false, me: me({}) })).toEqual({
      kind: 'login',
    })
  })

  // The sign-in page sends a signed-in visitor straight back, so a redirect here would loop.
  it('asks a signed-in admin the API rejects to sign out instead of redirecting', () => {
    expect(
      adminGate({ privyReady: true, authenticated: true, me: me({ error: expired }) }),
    ).toEqual({
      kind: 'error',
      message: "Your sign-in couldn't be confirmed. Sign out, then sign in again.",
    })
  })

  it('refuses an account without an admin profile', () => {
    expect(adminGate({ privyReady: true, authenticated: true, me: me({ error: denied }) })).toEqual(
      { kind: 'denied' },
    )
  })

  it('reports an outage instead of calling it a refusal', () => {
    expect(adminGate({ privyReady: true, authenticated: true, me: me({ error: broken }) })).toEqual(
      { kind: 'error', message: 'boom' },
    )
  })

  it('waits while the admin profile loads', () => {
    expect(
      adminGate({ privyReady: true, authenticated: true, me: me({ isPending: true }) }),
    ).toEqual({ kind: 'loading' })
  })

  it('lets an admin in', () => {
    expect(
      adminGate({ privyReady: true, authenticated: true, me: me({ data: { id: 'adm_1' } }) }),
    ).toEqual({ kind: 'ready', admin: { id: 'adm_1' } })
  })
})
