import { describe, expect, it } from 'vitest'

import { apiErrorToast } from '@/lib/api-error-toast'
import { AuthenticationError, StrimzApiError } from '@/lib/merchant-api/errors'

describe('apiErrorToast', () => {
  it("shows the API's message and request id under a generic title", () => {
    const error = new StrimzApiError(409, {
      code: 'onchain_fee_mismatch',
      message: 'the registry charges 150 bps but the growth tier needs 100 bps',
      requestId: 'req_123',
    })
    expect(apiErrorToast(error)).toEqual({
      title: 'Something went wrong.',
      description: 'the registry charges 150 bps but the growth tier needs 100 bps (ref req_123)',
    })
  })

  it('keeps the session-expired title for an authentication error', () => {
    const error = new AuthenticationError({
      code: 'authentication_error',
      message: 'token expired',
    })
    expect(apiErrorToast(error)).toEqual({
      title: 'Your session expired. Please sign in again.',
      description: 'token expired',
    })
  })

  it('describes a non-API error by its message', () => {
    expect(apiErrorToast(new Error('network down'))).toEqual({
      title: 'Something went wrong.',
      description: 'network down',
    })
  })
})
