import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const bff = vi.hoisted(() => ({
  bffSubmitPayment: vi.fn(),
  bffSubmitSubscription: vi.fn(),
  bffGetSubmission: vi.fn(),
}))

vi.mock('@/lib/strimz-bff', () => bff)

const { POST } = await import('../app/api/checkout/sessions/[sessionId]/submit/route')
const { GET } =
  await import('../app/api/checkout/sessions/[sessionId]/submissions/[idempotencyKey]/route')

const SESSION_ID = 'cmsession0000000000000001'
const HEX32 = `0x${'a'.repeat(64)}`
const SIG = { v: 27, r: HEX32, s: `0x${'b'.repeat(64)}` }
const VIEW = { id: 'relay-pay-ab', idempotencyKey: 'relay-pay-ab', status: 'queued' }

function paymentBody(extra: Record<string, unknown> = {}) {
  return {
    kind: 'payment',
    merchantId: '1',
    token: `0x${'3'.repeat(40)}`,
    auth: {
      from: `0x${'4'.repeat(40)}`,
      amount: '1000000',
      validAfter: '0',
      validBefore: '1900000000',
      nonce: HEX32,
    },
    ref: HEX32,
    authSignature: SIG,
    intentSignature: SIG,
    ...extra,
  }
}

function subscriptionBody(extra: Record<string, unknown> = {}) {
  return {
    kind: 'subscription',
    merchantId: '1',
    token: `0x${'3'.repeat(40)}`,
    amount: '1000000',
    interval: 86_400,
    startAt: '0',
    endAt: '0',
    permitData: { owner: `0x${'5'.repeat(40)}`, value: '1', deadline: '1900000000' },
    permitSignature: SIG,
    intentSignature: SIG,
    ...extra,
  }
}

function post(body: unknown) {
  return POST(
    new Request(`https://strimz.test/api/checkout/sessions/${SESSION_ID}/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ sessionId: SESSION_ID }) },
  )
}

describe('checkout relay BFF', () => {
  beforeEach(() => {
    bff.bffSubmitPayment.mockResolvedValue(VIEW)
    bff.bffSubmitSubscription.mockResolvedValue(VIEW)
    bff.bffGetSubmission.mockResolvedValue(VIEW)
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('forwards a payment with the path session and without a client key', async () => {
    const res = await post(paymentBody({ idempotencyKey: SESSION_ID }))

    expect(res.status).toBe(200)
    const [forwarded] = bff.bffSubmitPayment.mock.calls[0] ?? []
    expect(forwarded).toMatchObject({ sessionId: SESSION_ID })
    expect(forwarded).not.toHaveProperty('idempotencyKey')
  })

  it('forwards a subscription with the path plan and without a client key', async () => {
    const res = await post(subscriptionBody({ idempotencyKey: `${SESSION_ID}-0xabc` }))

    expect(res.status).toBe(200)
    const [forwarded] = bff.bffSubmitSubscription.mock.calls[0] ?? []
    expect(forwarded).toMatchObject({ subscriptionInternalId: SESSION_ID })
    expect(forwarded).not.toHaveProperty('idempotencyKey')
  })

  it('passes an upstream 409 through with its status and detail', async () => {
    const detail = { error: { code: 'attempt_in_progress', details: { submission: VIEW } } }
    bff.bffSubmitPayment.mockRejectedValue(
      Object.assign(new Error('an earlier attempt can still land'), { status: 409, detail }),
    )

    const res = await post(paymentBody())

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ detail })
  })

  it('looks a submission up within the path session', async () => {
    const res = await GET(new Request('https://strimz.test/x') as never, {
      params: Promise.resolve({ sessionId: SESSION_ID, idempotencyKey: 'relay-pay-ab' }),
    })

    expect(res.status).toBe(200)
    expect(bff.bffGetSubmission).toHaveBeenCalledWith('relay-pay-ab', SESSION_ID)
  })
})
