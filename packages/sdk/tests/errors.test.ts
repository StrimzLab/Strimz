import { describe, it, expect } from 'vitest'
import {
  classifyError,
  StrimzAuthenticationError,
  StrimzPermissionError,
  StrimzValidationError,
  StrimzNotFoundError,
  StrimzIdempotencyError,
  StrimzRateLimitError,
  StrimzError,
} from '../src/errors.js'

describe('classifyError', () => {
  const body = (code: string) => ({ code: code as never, message: 'msg', requestId: 'req_1' })

  it('401 → StrimzAuthenticationError', () => {
    expect(classifyError(401, body('authentication_error'))).toBeInstanceOf(
      StrimzAuthenticationError,
    )
  })

  it('403 → StrimzPermissionError', () => {
    expect(classifyError(403, body('permission_denied'))).toBeInstanceOf(StrimzPermissionError)
  })

  it('404 → StrimzNotFoundError', () => {
    expect(classifyError(404, body('not_found'))).toBeInstanceOf(StrimzNotFoundError)
  })

  it('409 idempotency_error → StrimzIdempotencyError', () => {
    expect(classifyError(409, body('idempotency_error'))).toBeInstanceOf(StrimzIdempotencyError)
  })

  it('422 → StrimzValidationError', () => {
    expect(classifyError(422, body('invalid_request'))).toBeInstanceOf(StrimzValidationError)
  })

  it('429 → StrimzRateLimitError with retry-after', () => {
    const e = classifyError(429, body('rate_limited'), 5_000) as StrimzRateLimitError
    expect(e).toBeInstanceOf(StrimzRateLimitError)
    expect(e.retryAfterMs).toBe(5_000)
  })

  it('500 → generic StrimzError', () => {
    const e = classifyError(500, body('api_error'))
    expect(e).toBeInstanceOf(StrimzError)
    expect(e).not.toBeInstanceOf(StrimzNotFoundError)
  })
})
