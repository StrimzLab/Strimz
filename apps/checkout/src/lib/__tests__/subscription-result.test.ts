import { describe, expect, it, vi } from 'vitest'
import {
  buildSubscriptionReturnUrl,
  postSubscriptionResult,
  subscriptionCancelDestination,
  subscriptionResultForPhase,
  waitForSubscriptionId,
} from '@/lib/subscription-result'

const txHash = `0x${'cd'.repeat(32)}`
const PARENT = 'https://app.example'

describe('buildSubscriptionReturnUrl', () => {
  it('fills in the subscription id and tx hash, URL-encoded', () => {
    expect(
      buildSubscriptionReturnUrl(
        'https://app.example/welcome?sub={SUBSCRIPTION_ID}&tx={ON_CHAIN_TX_HASH}&s={SUBSCRIPTION_ID}',
        { subscriptionId: 'sub 1&x', txHash },
      ),
    ).toBe(`https://app.example/welcome?sub=sub%201%26x&tx=${txHash}&s=sub%201%26x`)
  })

  it('leaves unknown values blank', () => {
    expect(
      buildSubscriptionReturnUrl(
        'https://app.example/w?sub={SUBSCRIPTION_ID}&tx={ON_CHAIN_TX_HASH}',
        {
          subscriptionId: null,
          txHash: null,
        },
      ),
    ).toBe('https://app.example/w?sub=&tx=')
  })
})

describe('subscriptionResultForPhase', () => {
  const base = { planId: 'plan_1', txHash, error: null }

  it('waits for the subscription id lookup before reporting success', () => {
    expect(
      subscriptionResultForPhase({ ...base, phase: 'confirmed', subscriptionId: undefined }),
    ).toBeNull()
    expect(
      subscriptionResultForPhase({ ...base, phase: 'confirmed', subscriptionId: 'sub_1' }),
    ).toEqual({
      type: 'strimz:subscription:success',
      planId: 'plan_1',
      subscriptionId: 'sub_1',
      txHash,
    })
    expect(
      subscriptionResultForPhase({ ...base, phase: 'confirmed', subscriptionId: null }),
    ).toMatchObject({ subscriptionId: null })
  })

  it('reports success only with a tx hash', () => {
    expect(
      subscriptionResultForPhase({
        ...base,
        txHash: null,
        phase: 'confirmed',
        subscriptionId: 'sub_1',
      }),
    ).toBeNull()
  })

  it.each([
    ['load_error', 'load_failed'],
    ['not_ready', 'merchant_not_ready'],
    ['reverted', 'payment_reverted'],
    ['already_subscribed', 'already_subscribed'],
  ] as const)('maps %s to %s', (phase, code) => {
    expect(subscriptionResultForPhase({ ...base, phase, subscriptionId: undefined })).toMatchObject(
      {
        type: 'strimz:subscription:error',
        planId: 'plan_1',
        code,
      },
    )
  })

  it('stays quiet while the payer can still finish', () => {
    for (const phase of [
      'loading',
      'connect',
      'ready',
      'signing',
      'submitting',
      'polling',
      'failed',
    ] as const) {
      expect(subscriptionResultForPhase({ ...base, phase, subscriptionId: undefined })).toBeNull()
    }
  })
})

describe('postSubscriptionResult', () => {
  const message = { type: 'strimz:subscription:cancel', planId: 'plan_1' } as const

  it('posts to the parent in an embed and the opener in a popup, at the parent origin', () => {
    const parent = { postMessage: vi.fn() }
    const opener = { postMessage: vi.fn() }

    postSubscriptionResult({ mode: 'embed', parentOrigin: PARENT }, message, { parent, opener })
    postSubscriptionResult({ mode: 'popup', parentOrigin: PARENT }, message, { parent, opener })

    expect(parent.postMessage).toHaveBeenCalledWith(message, PARENT)
    expect(opener.postMessage).toHaveBeenCalledWith(message, PARENT)
  })

  it('posts nothing without a parent origin or on a full page', () => {
    const parent = { postMessage: vi.fn() }
    postSubscriptionResult({ mode: 'embed', parentOrigin: null }, message, { parent, opener: null })
    postSubscriptionResult({ mode: 'page', parentOrigin: null }, message, { parent, opener: null })
    expect(parent.postMessage).not.toHaveBeenCalled()
  })

  it('refuses a malformed message', () => {
    expect(() =>
      postSubscriptionResult(
        { mode: 'embed', parentOrigin: PARENT },
        { type: 'strimz:subscription:cancel' },
        { parent: { postMessage: vi.fn() }, opener: null },
      ),
    ).toThrow()
  })
})

describe('subscriptionCancelDestination', () => {
  it('uses the cancel URL on a full page only', () => {
    expect(
      subscriptionCancelDestination(
        { mode: 'page', parentOrigin: null },
        'https://app.example/pricing',
      ),
    ).toBe('https://app.example/pricing')
    expect(
      subscriptionCancelDestination(
        { mode: 'embed', parentOrigin: PARENT },
        'https://app.example/pricing',
      ),
    ).toBeNull()
    expect(subscriptionCancelDestination({ mode: 'page', parentOrigin: null }, null)).toBeNull()
  })

  it('blanks placeholders, since nothing was created', () => {
    expect(
      subscriptionCancelDestination(
        { mode: 'page', parentOrigin: null },
        'https://app.example/c?sub={SUBSCRIPTION_ID}',
      ),
    ).toBe('https://app.example/c?sub=')
  })
})

describe('waitForSubscriptionId', () => {
  const instant = { intervalMs: 2_000, timeoutMs: 30_000 }

  function clock() {
    let now = 0
    return {
      now: () => now,
      sleep: (ms: number) => {
        now += ms
        return Promise.resolve()
      },
    }
  }

  it('returns the id once the subscription is recorded', async () => {
    const status = vi
      .fn()
      .mockResolvedValueOnce({ active: false, subscriptionId: null })
      .mockResolvedValueOnce({ active: true, subscriptionId: 'sub_1' })

    await expect(waitForSubscriptionId(status, { ...instant, ...clock() })).resolves.toBe('sub_1')
    expect(status).toHaveBeenCalledTimes(2)
  })

  it('gives up with null after the timeout', async () => {
    const status = vi.fn().mockResolvedValue({ active: false, subscriptionId: null })

    await expect(waitForSubscriptionId(status, { ...instant, ...clock() })).resolves.toBeNull()
    expect(status).toHaveBeenCalledTimes(15)
  })

  it('keeps polling through a failed lookup', async () => {
    const status = vi
      .fn()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce({ active: true, subscriptionId: 'sub_2' })

    await expect(waitForSubscriptionId(status, { ...instant, ...clock() })).resolves.toBe('sub_2')
  })
})
