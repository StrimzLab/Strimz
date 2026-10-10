import { describe, expect, it } from 'vitest'

import { tierRefusal } from '@/lib/admin-api/tier-refusal'
import { StrimzApiError } from '@/lib/merchant-api/errors'

const details = { onchainMerchantId: '7', onchainFeeBps: 150, requiredFeeBps: 100, maxFeeBps: 500 }

describe('tierRefusal', () => {
  it('lists the on-chain facts of a fee mismatch', () => {
    const error = new StrimzApiError(409, {
      code: 'onchain_fee_mismatch',
      message: 'send setFeeBps(7, 100) with the admin key first',
      details,
    })
    expect(tierRefusal(error)).toEqual({
      message: 'send setFeeBps(7, 100) with the admin key first',
      facts: [
        ['On-chain merchant id', '7'],
        ['Registry fee', '150 bps'],
        ['Tier needs', '100 bps'],
        ['On-chain ceiling', '500 bps'],
      ],
    })
  })

  it('lists the on-chain facts of a fee above the ceiling', () => {
    const error = new StrimzApiError(409, {
      code: 'onchain_fee_above_ceiling',
      message: 'above the ceiling',
      details: { ...details, requiredFeeBps: 600 },
    })
    expect(tierRefusal(error)?.facts).toContainEqual(['Tier needs', '600 bps'])
  })

  it('shows the message alone for an unregistered merchant', () => {
    const error = new StrimzApiError(409, {
      code: 'merchant_not_registered',
      message: 'only the free tier can be set before registration',
    })
    expect(tierRefusal(error)).toEqual({
      message: 'only the free tier can be set before registration',
      facts: [],
    })
  })

  it('ignores errors that are not tier refusals', () => {
    expect(tierRefusal(new Error('boom'))).toBeNull()
    expect(tierRefusal(new StrimzApiError(500, { code: 'api_error', message: 'x' }))).toBeNull()
  })
})
