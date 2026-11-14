import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachPlanPayer, attachSessionPayer } from '../checkout-payer'

const PAYER = `0x${'d'.repeat(40)}`

function answer(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  )
}

function refusal(code: string, message: string) {
  return { error: { code, message } }
}

const attachSession = () =>
  attachSessionPayer({ sessionId: 'ses_1', email: 'payer@buyer.test', walletAddress: PAYER })

const attachPlan = () =>
  attachPlanPayer({ planId: 'plan_1', email: 'payer@buyer.test', walletAddress: PAYER })

describe('attaching a payer on the hosted checkout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tells a payer who switched wallets to reconnect or ask for a new link', async () => {
    answer(409, refusal('payer_already_bound', 'this checkout session is linked to another wallet'))

    await expect(attachSession()).rejects.toThrow(
      'This checkout is linked to another wallet. Reconnect it, or ask the merchant for a new link.',
    )
  })

  it('tells the payer a closed or expired checkout needs a new link', async () => {
    answer(409, refusal('session_not_open', 'this checkout session is no longer open'))

    await expect(attachSession()).rejects.toThrow(
      'This checkout is no longer open. Ask the merchant for a new link.',
    )
  })

  it('tells the payer an archived plan is no longer offered', async () => {
    answer(409, refusal('plan_not_active', 'this subscription plan is no longer offered'))

    await expect(attachPlan()).rejects.toThrow(
      'This plan is no longer offered. Ask the merchant for a new link.',
    )
  })

  it('still shows the API message for any other refusal', async () => {
    answer(400, refusal('validation_error', 'email must be a valid email'))

    await expect(attachSession()).rejects.toThrow('email must be a valid email')
  })

  it('resolves with the customer id once attached', async () => {
    answer(201, { customerId: 'cus_1' })

    await expect(attachSession()).resolves.toEqual({ customerId: 'cus_1' })
  })
})
