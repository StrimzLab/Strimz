import { describe, expect, it } from 'vitest'

import { tierRefusal } from '@/lib/admin-api/tier-refusal'
import { StrimzApiError } from '@/lib/merchant-api/errors'

describe('tierRefusal', () => {
  it('shows the message of a refusal for an unregistered merchant', () => {
    const error = new StrimzApiError(409, {
      code: 'merchant_not_registered',
      message: 'the merchant is not registered on-chain yet',
    })
    expect(tierRefusal(error)).toEqual({ message: 'the merchant is not registered on-chain yet' })
  })

  it('no longer reads the fee-mismatch codes the API stopped sending', () => {
    for (const code of ['onchain_fee_mismatch', 'onchain_fee_above_ceiling']) {
      expect(tierRefusal(new StrimzApiError(409, { code, message: 'x' }))).toBeNull()
    }
  })

  it('ignores errors that are not tier refusals', () => {
    expect(tierRefusal(new Error('boom'))).toBeNull()
    expect(tierRefusal(new StrimzApiError(500, { code: 'api_error', message: 'x' }))).toBeNull()
  })
})
