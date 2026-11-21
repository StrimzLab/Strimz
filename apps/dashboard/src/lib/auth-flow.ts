export type AuthStep = 'send' | 'code' | 'google' | 'passkey' | 'link'

type StoreLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const CANCELLED = new Set(['oauth_user_denied', 'exited_auth_flow', 'passkey_not_allowed'])

const BY_CODE: Readonly<Record<string, string>> = {
  must_be_authenticated: 'Your session ended. Sign in again, then add your passkey.',
  invalid_credentials: "That code isn't right. Check the latest email from Strimz and try again.",
  too_many_requests: 'Too many attempts. Wait a minute and try again.',
  user_does_not_exist: "There's no Strimz account for that yet. Create one instead.",
  disallowed_login_method: "That sign-in method isn't available for Strimz.",
  disallowed_plus_email: 'Use an email address without a + in it.',
  client_request_timeout: 'This is taking too long. Check your connection and try again.',
  oauth_account_suspended: 'That Google account is suspended. Use another one.',
  captcha_failure: "We couldn't confirm you're not a bot. Try again, or try another browser.",
  captcha_timeout: "We couldn't confirm you're not a bot. Try again, or try another browser.",
  invalid_captcha: "We couldn't confirm you're not a bot. Try again, or try another browser.",
}

const FALLBACK: Record<AuthStep, string> = {
  send: "We couldn't send the code. Try again in a moment.",
  code: "We couldn't check that code. Try again in a moment.",
  google: "Google sign-in didn't finish. Try again.",
  passkey: "Your passkey didn't work. Try again, or use your email.",
  link: "We couldn't add the passkey. Try again, or skip for now.",
}

/** A sentence for the person, or null when they cancelled and there's nothing to say. */
export function authErrorMessage(err: unknown, step: AuthStep): string | null {
  const code = (err as { privyErrorCode?: unknown } | null)?.privyErrorCode
  if (typeof code === 'string') {
    if (CANCELLED.has(code)) return null
    const known = BY_CODE[code]
    if (known) return known
  }
  // WebAuthn reports a dismissed prompt this way.
  if (
    (step === 'passkey' || step === 'link') &&
    (err as { name?: unknown } | null)?.name === 'NotAllowedError'
  ) {
    return null
  }
  return FALLBACK[step]
}

export function normaliseCode(input: string): string {
  return input.replace(/\D/gu, '').slice(0, 6)
}

const SIGNUP_TOKEN_KEY = 'strimz:signup-turnstile'
/** Turnstile tokens last 300 seconds; leave room for the sync request. */
export const SIGNUP_TOKEN_TTL_MS = 280_000

function sessionStore(): StoreLike | null {
  try {
    return window.sessionStorage
  } catch {
    // Blocked storage: the callback page shows the check again instead.
    return null
  }
}

export function saveSignupToken(token: string, store: StoreLike | null = sessionStore()): void {
  store?.setItem(SIGNUP_TOKEN_KEY, JSON.stringify({ token, at: Date.now() }))
}

/** The saved token, once. Null when there's none or it's too old to pass. */
export function readSignupToken(store: StoreLike | null = sessionStore()): string | null {
  if (!store) return null
  const raw = store.getItem(SIGNUP_TOKEN_KEY)
  store.removeItem(SIGNUP_TOKEN_KEY)
  if (!raw) return null
  const saved = JSON.parse(raw) as { token?: unknown; at?: unknown }
  if (typeof saved.token !== 'string' || typeof saved.at !== 'number') return null
  return Date.now() - saved.at <= SIGNUP_TOKEN_TTL_MS ? saved.token : null
}

/** Turnstile's flexible widget is at least 300px wide; narrower cards get the compact one. */
export function turnstileSizeFor(width: number): 'flexible' | 'compact' {
  return width < 360 ? 'compact' : 'flexible'
}
