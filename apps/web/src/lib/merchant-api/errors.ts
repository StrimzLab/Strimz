/**
 * Typed errors surfaced by the merchant API client.
 *
 * Why a class hierarchy: the upper layers (hooks, components) want to
 * branch on intent. "redirect to login", "show a toast", "render the
 * inline form error". A flat `Error` with a `code` string forces every
 * call site into a switch on stringly-typed values. A class hierarchy
 * lets TypeScript narrow on `instanceof` and the linter catches
 * unhandled branches.
 *
 * Why the codes still exist alongside the classes: the API's error
 * envelope is `{ code, message, details? }`. The code is what apps/api
 * documents externally and what shows up in logs. Carrying it on the
 * class preserves that contract without forcing a separate lookup.
 */

/** Shape of the JSON error envelope returned by apps/api. */
export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

/**
 * Base class for every error the merchant API client throws. Carries
 * the HTTP status, the API's documented error code, and the raw body
 * so debug surfaces can render the full envelope without parsing twice.
 */
export class StrimzApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, body: ApiErrorBody) {
    super(body.message || `Strimz API error ${status}`)
    this.name = 'StrimzApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
    // Preserves the original stack on V8. Without this the class
    // constructor itself shows up as the throwing frame.
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/** 401. Privy token missing, expired, or rejected by the guard. */
export class AuthenticationError extends StrimzApiError {
  constructor(body: ApiErrorBody) {
    super(401, body)
    this.name = 'AuthenticationError'
  }
}

/** 403. Token valid but the merchant is disabled, or the role lacks scope. */
export class ForbiddenError extends StrimzApiError {
  constructor(body: ApiErrorBody) {
    super(403, body)
    this.name = 'ForbiddenError'
  }
}

/** 404. Resource doesn't exist or is scoped to a different merchant. */
export class NotFoundError extends StrimzApiError {
  constructor(body: ApiErrorBody) {
    super(404, body)
    this.name = 'NotFoundError'
  }
}

/** 422. Input failed validation; `details` carries the Zod issue list. */
export class ValidationError extends StrimzApiError {
  constructor(body: ApiErrorBody) {
    super(422, body)
    this.name = 'ValidationError'
  }
}

/** 429. Rate limit hit. The `Retry-After` header is forwarded on the class. */
export class RateLimitError extends StrimzApiError {
  readonly retryAfterSeconds: number | null
  constructor(body: ApiErrorBody, retryAfterSeconds: number | null) {
    super(429, body)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/**
 * Specifically for the dashboard's first-time-login path: the Privy
 * token is valid but `/v1/auth/sync` hasn't been called yet. The
 * dashboard catches this to redirect to onboarding instead of bouncing
 * the user back to login. Distinct from `AuthenticationError`.
 */
export class MerchantNotSyncedError extends StrimzApiError {
  constructor(body: ApiErrorBody) {
    super(401, body)
    this.name = 'MerchantNotSyncedError'
  }
}

/**
 * Maps a raw error envelope + status to a specific subclass. Falls back
 * to the base class for codes we don't model individually (5xx, network
 * blips, etc.). Centralised here so every consumer gets the same mapping.
 */
export function buildApiError(
  status: number,
  body: ApiErrorBody,
  headers?: Headers,
): StrimzApiError {
  if (status === 401) {
    if (body.code === 'merchant_not_synced') return new MerchantNotSyncedError(body)
    return new AuthenticationError(body)
  }
  if (status === 403) return new ForbiddenError(body)
  if (status === 404) return new NotFoundError(body)
  if (status === 422) return new ValidationError(body)
  if (status === 429) {
    const retryAfter = headers?.get('retry-after')
    const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : null
    return new RateLimitError(body, Number.isFinite(seconds) ? seconds : null)
  }
  return new StrimzApiError(status, body)
}

/**
 * Type guard helpers. Cleaner at call sites than repeated
 * `instanceof` chains.
 */
export const isAuthError = (e: unknown): e is AuthenticationError | MerchantNotSyncedError =>
  e instanceof AuthenticationError || e instanceof MerchantNotSyncedError

export const isNotFound = (e: unknown): e is NotFoundError => e instanceof NotFoundError

export const isValidation = (e: unknown): e is ValidationError => e instanceof ValidationError
