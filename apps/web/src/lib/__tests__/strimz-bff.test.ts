import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('bffGetSubmission', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('STRIMZ_INTERNAL_API_KEY', 'sk_test_internal')
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.strimz.test')
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('scopes the relay lookup to the checkout session', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'relay-pay-ab' })))
    const { bffGetSubmission } = await import('../strimz-bff')

    await bffGetSubmission('relay-pay-ab', 'cmsession0000000000000001')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.strimz.test/v1/relay/submissions/relay-pay-ab?sessionId=cmsession0000000000000001',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }))
    const { bffGetSubmission } = await import('../strimz-bff')

    expect(await bffGetSubmission('relay-pay-ab', 'cmsession0000000000000001')).toBeNull()
  })
})
