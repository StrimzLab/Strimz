import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  checkoutSubmissionUrl,
  inProgressSubmission,
  submitCheckoutRelay,
  type RelaySubmissionView,
} from '../checkout-submission'
import { env } from '../env'

const VIEW: RelaySubmissionView = {
  id: 'relay-pay-ab',
  idempotencyKey: 'relay-pay-ab',
  status: 'queued',
  txHash: null,
  reason: 'payWithAuthorization',
  errorReason: null,
  attemptCount: 0,
  enqueuedAt: '2026-10-03T00:00:00.000Z',
}

const BODY = { merchantId: '7', token: `0x${'3'.repeat(40)}` }

function conflict(code: string, submission: RelaySubmissionView | null) {
  return {
    error: {
      code,
      message: 'an earlier attempt for this checkout can still land',
      details: { submission },
    },
  }
}

function apiError(code: string, message = `api says ${code}`) {
  return { error: { code, message } }
}

function respondWith(status: number, body: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('inProgressSubmission', () => {
  it('returns the live submission of an attempt_in_progress conflict', () => {
    expect(inProgressSubmission(conflict('attempt_in_progress', VIEW))).toEqual(VIEW)
  })

  it('ignores an attempt_in_progress whose submission already failed', () => {
    expect(
      inProgressSubmission(conflict('attempt_in_progress', { ...VIEW, status: 'failed' })),
    ).toBeNull()
  })

  it('ignores other conflicts and unshaped bodies', () => {
    expect(inProgressSubmission(conflict('already_settled', VIEW))).toBeNull()
    expect(inProgressSubmission(conflict('attempt_in_progress', null))).toBeNull()
    expect(inProgressSubmission({ message: 'submit failed (409)' })).toBeNull()
    expect(inProgressSubmission(null)).toBeNull()
  })
})

describe('submitCheckoutRelay', () => {
  it('posts a session payment to the public API relay route without credentials', async () => {
    const fetchMock = respondWith(201, VIEW)

    await expect(submitCheckoutRelay({ kind: 'sessions', id: 'ses 1' }, BODY)).resolves.toEqual(
      VIEW,
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${env.apiUrl}/v1/checkout/sessions/ses%201/relay`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(BODY)
    expect(new Headers(init.headers).has('authorization')).toBe(false)
  })

  it('posts a plan enrolment to the public plan relay route', async () => {
    const fetchMock = respondWith(201, { ...VIEW, reason: 'permitAndCreateSubscription' })

    await submitCheckoutRelay({ kind: 'plans', id: 'plan_1' }, BODY)

    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe(`${env.apiUrl}/v1/checkout/plans/plan_1/relay`)
  })

  it('resumes the live attempt on an attempt_in_progress conflict', async () => {
    respondWith(409, conflict('attempt_in_progress', VIEW))

    await expect(submitCheckoutRelay({ kind: 'sessions', id: 'ses_1' }, BODY)).resolves.toEqual(
      VIEW,
    )
  })

  it.each([
    ['insufficient_balance', 400, /not enough/i],
    ['amount_below_minimum', 400, /minimum/i],
    ['relay_budget_exhausted', 429, /today/i],
    ['rate_limited', 429, /too many/i],
    ['subscription_exists', 409, /already subscribes/i],
  ])('explains %s to the payer', async (code, status, message) => {
    respondWith(status, apiError(code))

    await expect(submitCheckoutRelay({ kind: 'plans', id: 'plan_1' }, BODY)).rejects.toThrow(
      message,
    )
  })

  it('surfaces the API message for any other refusal', async () => {
    respondWith(400, apiError('token_mismatch', 'token does not match the session currency USDC'))

    await expect(submitCheckoutRelay({ kind: 'sessions', id: 'ses_1' }, BODY)).rejects.toThrow(
      'token does not match the session currency USDC',
    )
  })

  it('falls back to the status when the API body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('bad gateway', { status: 502 }))),
    )

    await expect(submitCheckoutRelay({ kind: 'sessions', id: 'ses_1' }, BODY)).rejects.toThrow(
      'submit failed (502)',
    )
  })
})

describe('checkoutSubmissionUrl', () => {
  it('polls the public submissions route of the session or plan', () => {
    expect(checkoutSubmissionUrl({ kind: 'sessions', id: 'ses_1' }, 'relay-pay-ab')).toBe(
      `${env.apiUrl}/v1/checkout/sessions/ses_1/submissions/relay-pay-ab`,
    )
    expect(checkoutSubmissionUrl({ kind: 'plans', id: 'plan_1' }, 'relay-sub-cd')).toBe(
      `${env.apiUrl}/v1/checkout/plans/plan_1/submissions/relay-sub-cd`,
    )
  })
})
