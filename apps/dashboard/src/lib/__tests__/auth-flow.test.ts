import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  authErrorMessage,
  normaliseCode,
  readSignupToken,
  saveSignupToken,
  SIGNUP_TOKEN_TTL_MS,
  turnstileSizeFor,
} from '../auth-flow'

function privyError(code: string, message = `privy: ${code}`) {
  return Object.assign(new Error(message), { privyErrorCode: code })
}

describe('authErrorMessage', () => {
  it.each([
    ['invalid_credentials', 'code', /isn't right/i],
    ['too_many_requests', 'send', /wait a minute/i],
    ['user_does_not_exist', 'send', /create one/i],
    ['disallowed_plus_email', 'send', /\+/],
    ['client_request_timeout', 'google', /connection/i],
    ['captcha_failure', 'send', /bot/i],
  ] as const)('explains %s', (code, step, message) => {
    expect(authErrorMessage(privyError(code), step)).toMatch(message)
  })

  it.each([
    ['oauth_user_denied', 'google'],
    ['exited_auth_flow', 'google'],
    ['passkey_not_allowed', 'passkey'],
  ] as const)('says nothing when the person cancelled (%s)', (code, step) => {
    expect(authErrorMessage(privyError(code), step)).toBeNull()
  })

  it('explains a failed passkey add as an add, not a sign-in', () => {
    expect(authErrorMessage(new Error('boom'), 'link')).toMatch(/couldn't add/i)
    expect(authErrorMessage(privyError('must_be_authenticated'), 'link')).toMatch(/sign in again/i)
  })

  it('treats a browser passkey cancel as a cancel', () => {
    const cancelled = Object.assign(new Error('The operation was aborted'), {
      name: 'NotAllowedError',
    })
    expect(authErrorMessage(cancelled, 'passkey')).toBeNull()
  })

  it('falls back to a plain message for each step, never the raw error', () => {
    const raw = new Error('TypeError: x is undefined')
    for (const step of ['send', 'code', 'google', 'passkey'] as const) {
      const message = authErrorMessage(raw, step)
      expect(message).toBeTruthy()
      expect(message).not.toContain('TypeError')
    }
  })
})

describe('normaliseCode', () => {
  it('keeps the first six digits', () => {
    expect(normaliseCode(' 12 34-56789')).toBe('123456')
    expect(normaliseCode('abc')).toBe('')
  })
})

function memoryStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const items = new Map<string, string>()
  return {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
  }
}

describe('signup token', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hands back a saved token once', () => {
    const store = memoryStore()
    saveSignupToken('tok', store)
    expect(readSignupToken(store)).toBe('tok')
    expect(readSignupToken(store)).toBeNull()
  })

  it('drops a token too old for Turnstile to accept', () => {
    vi.useFakeTimers()
    const store = memoryStore()
    saveSignupToken('tok', store)
    vi.advanceTimersByTime(SIGNUP_TOKEN_TTL_MS + 1)
    expect(readSignupToken(store)).toBeNull()
  })

  it('works without storage; the callback page asks again', () => {
    expect(() => saveSignupToken('tok', null)).not.toThrow()
    expect(readSignupToken(null)).toBeNull()
  })

  // #588: sign-up keeps one token; the test account asks for its own check.
  it('keeps a single token slot', () => {
    const store = memoryStore()
    saveSignupToken('first', store)
    saveSignupToken('second', store)
    expect(readSignupToken(store)).toBe('second')
    expect(readSignupToken(store)).toBeNull()
  })
})

describe('turnstileSizeFor', () => {
  it('uses the compact check on phones too narrow for the 300px one', () => {
    expect(turnstileSizeFor(320)).toBe('compact')
    expect(turnstileSizeFor(360)).toBe('flexible')
  })
})
