/**
 * Error hierarchy for the Strimz SDK.
 *
 * Every error thrown by the SDK extends `StrimzError`. The SDK never
 * resolves to `{ ok: false }` — it throws. This matches the Stripe / GitHub
 * SDK convention and keeps call sites linear.
 */

export type StrimzErrorCode =
  | 'authentication_error'
  | 'permission_denied'
  | 'invalid_request'
  | 'not_found'
  | 'idempotency_error'
  | 'rate_limited'
  | 'mode_mismatch'
  | 'merchant_not_found'
  | 'merchant_inactive'
  | 'token_not_whitelisted'
  | 'compliance_blocked'
  | 'session_expired'
  | 'session_invalid_state'
  | 'webhook_signature_invalid'
  | 'api_error'
  | 'network_error'
  | 'timeout'
  | 'parse_error'
  | 'unknown'

export interface StrimzErrorBody {
  code: StrimzErrorCode
  message: string
  param?: string
  requestId?: string
  details?: Record<string, unknown>
}

export class StrimzError extends Error {
  public readonly code: StrimzErrorCode
  public readonly httpStatus: number | undefined
  public readonly requestId: string | undefined
  public readonly param: string | undefined
  public readonly details: Record<string, unknown> | undefined

  constructor(body: StrimzErrorBody, httpStatus?: number) {
    super(body.message)
    this.name = 'StrimzError'
    this.code = body.code
    this.httpStatus = httpStatus
    this.requestId = body.requestId
    this.param = body.param
    this.details = body.details
  }
}

export class StrimzAuthenticationError extends StrimzError {
  constructor(body: StrimzErrorBody, httpStatus?: number) {
    super(body, httpStatus)
    this.name = 'StrimzAuthenticationError'
  }
}

export class StrimzPermissionError extends StrimzError {
  constructor(body: StrimzErrorBody, httpStatus?: number) {
    super(body, httpStatus)
    this.name = 'StrimzPermissionError'
  }
}

export class StrimzValidationError extends StrimzError {
  constructor(body: StrimzErrorBody, httpStatus?: number) {
    super(body, httpStatus)
    this.name = 'StrimzValidationError'
  }
}

export class StrimzNotFoundError extends StrimzError {
  constructor(body: StrimzErrorBody, httpStatus?: number) {
    super(body, httpStatus)
    this.name = 'StrimzNotFoundError'
  }
}

export class StrimzIdempotencyError extends StrimzError {
  constructor(body: StrimzErrorBody, httpStatus?: number) {
    super(body, httpStatus)
    this.name = 'StrimzIdempotencyError'
  }
}

export class StrimzRateLimitError extends StrimzError {
  public readonly retryAfterMs: number | undefined
  constructor(body: StrimzErrorBody, httpStatus?: number, retryAfterMs?: number) {
    super(body, httpStatus)
    this.name = 'StrimzRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class StrimzNetworkError extends StrimzError {
  public override readonly cause: unknown
  constructor(message: string, cause: unknown) {
    super({ code: 'network_error', message })
    this.name = 'StrimzNetworkError'
    this.cause = cause
  }
}

export class StrimzTimeoutError extends StrimzError {
  constructor(message: string) {
    super({ code: 'timeout', message })
    this.name = 'StrimzTimeoutError'
  }
}

export class StrimzModeMismatchError extends StrimzError {
  constructor(message: string) {
    super({ code: 'mode_mismatch', message })
    this.name = 'StrimzModeMismatchError'
  }
}

/** Map an HTTP status + body to the right StrimzError subclass. */
export function classifyError(httpStatus: number, body: StrimzErrorBody, retryAfterMs?: number): StrimzError {
  if (httpStatus === 401) return new StrimzAuthenticationError(body, httpStatus)
  if (httpStatus === 403) return new StrimzPermissionError(body, httpStatus)
  if (httpStatus === 404) return new StrimzNotFoundError(body, httpStatus)
  if (httpStatus === 409 && body.code === 'idempotency_error') {
    return new StrimzIdempotencyError(body, httpStatus)
  }
  if (httpStatus === 422) return new StrimzValidationError(body, httpStatus)
  if (httpStatus === 429) return new StrimzRateLimitError(body, httpStatus, retryAfterMs)
  return new StrimzError(body, httpStatus)
}
