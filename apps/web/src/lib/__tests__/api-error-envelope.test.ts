import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdminApiClient } from '@/lib/admin-api/client'
import { MerchantApiClient } from '@/lib/merchant-api/client'
import { MerchantNotSyncedError, StrimzApiError } from '@/lib/merchant-api/errors'

const FEE_MISMATCH = {
  error: {
    code: 'onchain_fee_mismatch',
    message:
      'the registry charges 150 bps but the growth tier needs 100 bps; send setFeeBps(7, 100) with the admin key first',
    requestId: 'req_123',
    details: { onchainMerchantId: '7', onchainFeeBps: 150, requiredFeeBps: 100, maxFeeBps: 500 },
  },
}

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })))
}

function merchantClient() {
  return new MerchantApiClient({
    baseUrl: 'https://api.strimz.test',
    getAccessToken: () => Promise.resolve('privy-token'),
    getMode: () => 'test',
  })
}

function adminClient() {
  return new AdminApiClient({
    getAccessToken: () => Promise.resolve('privy-token'),
    bffBaseUrl: 'https://app.strimz.test',
  })
}

describe('API error envelope', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('merchant client carries the code, message, details and request id of an API error', async () => {
    stubFetch(409, FEE_MISMATCH)
    const error = await merchantClient()
      .post('/v1/anything', {})
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StrimzApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'onchain_fee_mismatch',
      message: FEE_MISMATCH.error.message,
      requestId: 'req_123',
      details: FEE_MISMATCH.error.details,
    })
  })

  it('merchant client recognises merchant_not_synced', async () => {
    stubFetch(401, { error: { code: 'merchant_not_synced', message: 'merchant not synced' } })
    const error = await merchantClient()
      .get('/v1/auth/me')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(MerchantNotSyncedError)
  })

  it('admin client carries the code, message, details and request id of a tier refusal', async () => {
    stubFetch(409, FEE_MISMATCH)
    const error = await adminClient()
      .setMerchantTier('mer_1', { tier: 'growth' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StrimzApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'onchain_fee_mismatch',
      message: FEE_MISMATCH.error.message,
      requestId: 'req_123',
      details: FEE_MISMATCH.error.details,
    })
  })

  it.each([
    ['an unexpected JSON body', { detail: 'nope' }],
    ['an envelope without a code', { error: { message: 'no code' } }],
  ])('keeps the status and a readable message for %s', async (_case, body) => {
    stubFetch(500, body)
    const error = await merchantClient()
      .get('/v1/anything')
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StrimzApiError)
    expect(error).toMatchObject({
      status: 500,
      code: 'unknown_error',
      message: 'request failed with status 500',
    })
  })
})
