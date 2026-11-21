import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cancelManagedSubscription,
  listManagedSubscriptions,
  manageReducer,
  initialManageState,
  type ManagedSubscription,
} from '../manage-subscriptions'
import { RelayUnavailableError } from '../checkout-submission'

const SUB: ManagedSubscription = {
  subscriptionId: 'sub_1',
  onchainSubscriptionId: 7,
  merchantName: 'Acme',
  planName: 'Pro',
  amount: '2000000',
  currency: 'USDC',
  status: 'active',
  nextChargeAt: '2026-12-21T00:00:00.000Z',
  currentPeriodEndAt: '2026-12-21T00:00:00.000Z',
}

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('manage page state', () => {
  it('starts by asking the subscriber to sign in', () => {
    expect(initialManageState.phase).toBe('signin')
  })

  it('shows the list once it loads, or the empty state when there is nothing open', () => {
    const loading = manageReducer(initialManageState, { type: 'signing_in' })
    expect(loading.phase).toBe('loading')

    const loaded = manageReducer(loading, {
      type: 'loaded',
      view: {
        chainId: 5042002,
        subscriptionsAddress: '0x0000000000000000000000000000000000000a03',
        data: [SUB],
      },
    })
    expect(loaded.phase).toBe('list')
    expect(loaded.subscriptions).toEqual([SUB])

    const empty = manageReducer(loading, {
      type: 'loaded',
      view: {
        chainId: 5042002,
        subscriptionsAddress: '0x0000000000000000000000000000000000000a03',
        data: [],
      },
    })
    expect(empty.phase).toBe('empty')
  })

  it('tracks one cancel at a time and marks it cancelled once the chain confirms it', () => {
    const listed = manageReducer(manageReducer(initialManageState, { type: 'signing_in' }), {
      type: 'loaded',
      view: {
        chainId: 5042002,
        subscriptionsAddress: '0x0000000000000000000000000000000000000a03',
        data: [SUB],
      },
    })
    const cancelling = manageReducer(listed, { type: 'cancel_started', subscriptionId: 'sub_1' })
    expect(cancelling.cancelling).toBe('sub_1')

    const done = manageReducer(cancelling, { type: 'cancel_confirmed', subscriptionId: 'sub_1' })
    expect(done.cancelling).toBeNull()
    expect(done.cancelled).toEqual(['sub_1'])
    expect(done.subscriptions).toEqual([SUB])
  })

  it('keeps the list and shows the error when a cancel fails', () => {
    const listed = manageReducer(manageReducer(initialManageState, { type: 'signing_in' }), {
      type: 'loaded',
      view: {
        chainId: 5042002,
        subscriptionsAddress: '0x0000000000000000000000000000000000000a03',
        data: [SUB],
      },
    })
    const failed = manageReducer(
      manageReducer(listed, { type: 'cancel_started', subscriptionId: 'sub_1' }),
      {
        type: 'cancel_failed',
        message: 'The cancel did not go through.',
      },
    )
    expect(failed.phase).toBe('list')
    expect(failed.cancelling).toBeNull()
    expect(failed.error).toBe('The cancel did not go through.')
  })

  it('goes back to sign-in when loading fails', () => {
    const failed = manageReducer(manageReducer(initialManageState, { type: 'signing_in' }), {
      type: 'load_failed',
      message: 'Sign-in expired',
    })
    expect(failed.phase).toBe('signin')
    expect(failed.error).toBe('Sign-in expired')
  })
})

describe('manage API calls', () => {
  it('posts the signed sign-in and returns the list', async () => {
    const fetchMock = respond(201, { chainId: 5042002, subscriptionsAddress: '0xabc', data: [SUB] })
    vi.stubGlobal('fetch', fetchMock)

    const view = await listManagedSubscriptions({
      payer: '0x0000000000000000000000000000000000000abc',
      issuedAt: 1_700_000_000n,
      signature: '0x12',
    })

    expect(view.data).toEqual([SUB])
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/v1\/checkout\/manage\/subscriptions$/u)
    expect(JSON.parse(String(init.body))).toEqual({
      payer: '0x0000000000000000000000000000000000000abc',
      issuedAt: '1700000000',
      signature: '0x12',
    })
  })

  it('explains a rejected signature in plain words', async () => {
    vi.stubGlobal('fetch', respond(400, { error: { code: 'invalid_signature', message: 'x' } }))

    await expect(
      listManagedSubscriptions({
        payer: '0x0000000000000000000000000000000000000abc',
        issuedAt: 1n,
        signature: '0x12',
      }),
    ).rejects.toThrow(
      "That signature doesn't match this wallet. Try again from the wallet that subscribed.",
    )
  })

  it('posts the signed cancel for one subscription', async () => {
    const fetchMock = respond(201, { idempotencyKey: 'relay-cancel-1', status: 'queued' })
    vi.stubGlobal('fetch', fetchMock)

    const submitted = await cancelManagedSubscription('sub_1', { deadline: 99n, signature: '0x34' })

    expect(submitted.idempotencyKey).toBe('relay-cancel-1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/v1\/checkout\/manage\/subscriptions\/sub_1\/cancel$/u)
    expect(JSON.parse(String(init.body))).toEqual({ deadline: '99', signature: '0x34' })
  })
})

describe('cancel when Strimz will not pay the gas', () => {
  const call = { to: `0x${'a'.repeat(40)}`, data: '0x1234', chainId: 5042002 } as const

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hands back the signed cancel so the payer can send it', async () => {
    vi.stubGlobal(
      'fetch',
      respond(402, {
        error: { code: 'relay_unavailable', details: { reason: 'payer_limited', call } },
      }),
    )

    const err = await cancelManagedSubscription('sub_1', {
      deadline: 99n,
      signature: '0x34',
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(RelayUnavailableError)
    expect((err as RelayUnavailableError).call).toEqual(call)
  })

  it('keeps the call for that subscription until it settles', () => {
    const offered = manageReducer(
      { ...initialManageState, cancelling: 'sub_1' },
      { type: 'cancel_self_pay', subscriptionId: 'sub_1', call },
    )
    expect(offered.cancelling).toBeNull()
    expect(offered.selfPay).toEqual({ subscriptionId: 'sub_1', call })

    const done = manageReducer(offered, { type: 'cancel_confirmed', subscriptionId: 'sub_1' })
    expect(done.selfPay).toBeNull()
    expect(done.cancelled).toContain('sub_1')
  })
})
