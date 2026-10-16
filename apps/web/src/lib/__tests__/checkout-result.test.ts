import { describe, expect, it, vi } from 'vitest'
import {
  buildReturnUrl,
  cancelDestination,
  isCancellable,
  isContractAccount,
  postCheckoutResult,
  resolveCheckoutHost,
  resolveParentOrigin,
  resultMessageForPhase,
} from '@/lib/checkout-result'

const txHash = `0x${'cd'.repeat(32)}`

describe('buildReturnUrl', () => {
  it('fills in the session id and tx hash, URL-encoded', () => {
    expect(
      buildReturnUrl(
        'https://shop.example/thanks?session={CHECKOUT_SESSION_ID}&tx={ON_CHAIN_TX_HASH}',
        { sessionId: 'sess 1&x', txHash },
      ),
    ).toBe(`https://shop.example/thanks?session=sess%201%26x&tx=${txHash}`)
  })

  it('leaves the hash blank when there is none', () => {
    expect(
      buildReturnUrl('https://shop.example/c?s={CHECKOUT_SESSION_ID}&tx={ON_CHAIN_TX_HASH}', {
        sessionId: 'sess_1',
        txHash: null,
      }),
    ).toBe('https://shop.example/c?s=sess_1&tx=')
  })

  it('replaces every occurrence and nothing else', () => {
    expect(
      buildReturnUrl('https://shop.example/{CHECKOUT_SESSION_ID}/{OTHER}?a={CHECKOUT_SESSION_ID}', {
        sessionId: 'sess_1',
        txHash: null,
      }),
    ).toBe('https://shop.example/sess_1/{OTHER}?a=sess_1')
  })
})

describe('resolveParentOrigin', () => {
  it.each(['https://shop.example', 'http://localhost:3000'])('accepts %s', (origin) => {
    expect(resolveParentOrigin(origin)).toBe(origin)
  })

  it.each([
    null,
    '',
    '*',
    'javascript:alert(1)',
    'https://shop.example/checkout',
    'https://shop.example/',
    'file:///etc',
    'shop.example',
  ])('refuses %s', (raw) => {
    expect(resolveParentOrigin(raw)).toBeNull()
  })
})

describe('resolveCheckoutHost', () => {
  it('reads an embed with its parent', () => {
    expect(resolveCheckoutHost(new URLSearchParams('embed=1&parent=https://shop.example'))).toEqual(
      { mode: 'embed', parentOrigin: 'https://shop.example' },
    )
  })

  it('reads a popup with its parent', () => {
    expect(resolveCheckoutHost(new URLSearchParams('popup=1&parent=https://shop.example'))).toEqual(
      { mode: 'popup', parentOrigin: 'https://shop.example' },
    )
  })

  it('treats a plain link as a full page with nobody to tell', () => {
    expect(resolveCheckoutHost(new URLSearchParams('parent=https://shop.example'))).toEqual({
      mode: 'page',
      parentOrigin: null,
    })
  })

  it('keeps embed mode but drops a forged parent', () => {
    expect(resolveCheckoutHost(new URLSearchParams('embed=1&parent=*'))).toEqual({
      mode: 'embed',
      parentOrigin: null,
    })
  })
})

describe('postCheckoutResult', () => {
  const message = { type: 'strimz:checkout:success', sessionId: 'sess_1', txHash } as const

  function windows() {
    return { parent: { postMessage: vi.fn() }, opener: { postMessage: vi.fn() } }
  }

  it('posts to the embedding page with its exact origin', () => {
    const w = windows()
    postCheckoutResult({ mode: 'embed', parentOrigin: 'https://shop.example' }, message, w)
    expect(w.parent.postMessage).toHaveBeenCalledWith(message, 'https://shop.example')
    expect(w.opener.postMessage).not.toHaveBeenCalled()
  })

  it('posts to the opener from a popup', () => {
    const w = windows()
    postCheckoutResult({ mode: 'popup', parentOrigin: 'https://shop.example' }, message, w)
    expect(w.opener.postMessage).toHaveBeenCalledWith(message, 'https://shop.example')
    expect(w.parent.postMessage).not.toHaveBeenCalled()
  })

  it('posts nothing without a parent origin', () => {
    const w = windows()
    postCheckoutResult({ mode: 'embed', parentOrigin: null }, message, w)
    postCheckoutResult({ mode: 'page', parentOrigin: null }, message, w)
    expect(w.parent.postMessage).not.toHaveBeenCalled()
    expect(w.opener.postMessage).not.toHaveBeenCalled()
  })

  it('posts nothing when the window it would answer is gone', () => {
    expect(() =>
      postCheckoutResult({ mode: 'popup', parentOrigin: 'https://shop.example' }, message, {
        parent: null,
        opener: null,
      }),
    ).not.toThrow()
  })

  it('refuses a message outside the shared schema', () => {
    const w = windows()
    expect(() =>
      postCheckoutResult(
        { mode: 'embed', parentOrigin: 'https://shop.example' },
        { type: 'strimz:checkout:success', sessionId: 'sess_1', txHash: '0x1' },
        w,
      ),
    ).toThrow()
    expect(w.parent.postMessage).not.toHaveBeenCalled()
  })
})

describe('resultMessageForPhase', () => {
  const base = { sessionId: 'sess_1', txHash: null, error: null }

  it('reports success with the tx hash', () => {
    expect(resultMessageForPhase({ ...base, phase: 'confirmed', txHash })).toEqual({
      type: 'strimz:checkout:success',
      sessionId: 'sess_1',
      txHash,
    })
  })

  it.each([
    ['load_error', 'load_failed'],
    ['not_ready', 'merchant_not_ready'],
    ['reverted', 'payment_reverted'],
    ['unsupported_wallet', 'unsupported_wallet'],
  ] as const)('reports %s as %s', (phase, code) => {
    expect(resultMessageForPhase({ ...base, phase, error: 'details' })).toMatchObject({
      type: 'strimz:checkout:error',
      sessionId: 'sess_1',
      code,
    })
  })

  it.each(['loading', 'connect', 'ready', 'signing', 'submitting', 'polling', 'failed'] as const)(
    'reports nothing while the payer can still finish (%s)',
    (phase) => {
      expect(resultMessageForPhase({ ...base, phase })).toBeNull()
    },
  )

  it('reports nothing for a confirmation without a hash', () => {
    expect(resultMessageForPhase({ ...base, phase: 'confirmed' })).toBeNull()
  })
})

describe('cancelDestination', () => {
  const page = { mode: 'page', parentOrigin: null } as const

  it('sends a full-page payer to the cancel URL with the session filled in', () => {
    expect(
      cancelDestination(page, 'https://shop.example/cart?s={CHECKOUT_SESSION_ID}', 'sess_1'),
    ).toBe('https://shop.example/cart?s=sess_1')
  })

  it('stays on the page when there is no cancel URL', () => {
    expect(cancelDestination(page, null, 'sess_1')).toBeNull()
  })

  it.each(['embed', 'popup'] as const)('never navigates in a %s', (mode) => {
    expect(
      cancelDestination(
        { mode, parentOrigin: 'https://shop.example' },
        'https://shop.example/cart',
        'sess_1',
      ),
    ).toBeNull()
  })
})

describe('isContractAccount', () => {
  it.each([undefined, null, '0x'])('treats %s code as a regular wallet', (code) => {
    expect(isContractAccount(code)).toBe(false)
  })

  it('treats an EIP-7702 delegation as a regular wallet', () => {
    expect(isContractAccount(`0xef0100${'11'.repeat(20)}`)).toBe(false)
  })

  it('treats deployed code as a contract account', () => {
    expect(isContractAccount('0x6080604052')).toBe(true)
  })
})

describe('isCancellable', () => {
  it.each(['loading', 'load_error', 'not_ready', 'connect', 'ready', 'failed', 'reverted'])(
    'offers Cancel while nothing is in flight (%s)',
    (phase) => {
      expect(isCancellable(phase)).toBe(true)
    },
  )

  it.each(['signing', 'submitting', 'polling', 'confirmed'])(
    'hides Cancel once a payment may already be moving (%s)',
    (phase) => {
      expect(isCancellable(phase)).toBe(false)
    },
  )
})
