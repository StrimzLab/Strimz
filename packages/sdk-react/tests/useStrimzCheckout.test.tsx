import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  StrimzCheckoutError,
  StrimzProvider,
  useStrimzCheckout,
  type UseStrimzCheckoutOptions,
} from '../src/index.js'

const validKey = 'pk_test_' + 'a'.repeat(20)
const CHECKOUT = 'https://strimz.example'
const txHash = `0x${'ab'.repeat(32)}`

interface FakePopup {
  closed: boolean
  close: () => void
}

function fakePopup(): FakePopup {
  const popup: FakePopup = {
    closed: false,
    close: () => {
      popup.closed = true
    },
  }
  return popup
}

function setup(options: UseStrimzCheckoutOptions = {}) {
  const popup = fakePopup()
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  const hook = renderHook(() => useStrimzCheckout(options), {
    wrapper: ({ children }) => (
      <StrimzProvider publishableKey={validKey} checkoutOrigin={CHECKOUT}>
        {children}
      </StrimzProvider>
    ),
  })
  return { popup, open, hook }
}

function post(data: unknown, source: unknown, origin = CHECKOUT) {
  const ev = new MessageEvent('message', { data, origin })
  Object.defineProperty(ev, 'source', { value: source })
  act(() => {
    window.dispatchEvent(ev)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useStrimzCheckout popup', () => {
  it('tells the checkout which page to answer', () => {
    const { open, hook } = setup()
    act(() => hook.result.current.open('sess_1'))
    const url = new URL(String(open.mock.calls[0]?.[0]))
    expect(url.origin + url.pathname).toBe(`${CHECKOUT}/pay/sess_1`)
    expect(url.searchParams.get('popup')).toBe('1')
    expect(url.searchParams.get('parent')).toBe(window.location.origin)
  })

  it('calls onSuccess with the hash and closes the popup', () => {
    const onSuccess = vi.fn()
    const { popup, hook } = setup({ onSuccess })
    act(() => hook.result.current.open('sess_1'))
    post({ type: 'strimz:checkout:success', sessionId: 'sess_1', txHash }, popup)
    expect(onSuccess).toHaveBeenCalledWith(txHash)
    expect(popup.closed).toBe(true)
    expect(hook.result.current.status).toBe('success')
  })

  it('calls onCancel once when the payer closes the popup', () => {
    const onCancel = vi.fn()
    const { popup, hook } = setup({ onCancel })
    act(() => hook.result.current.open('sess_1'))
    popup.closed = true
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(hook.result.current.status).toBe('cancelled')
  })

  it('does not report a cancel after a success closed the popup', () => {
    const onCancel = vi.fn()
    const { popup, hook } = setup({ onCancel })
    act(() => hook.result.current.open('sess_1'))
    post({ type: 'strimz:checkout:success', sessionId: 'sess_1', txHash }, popup)
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('passes the error code to onError', () => {
    const onError = vi.fn()
    const { popup, hook } = setup({ onError })
    act(() => hook.result.current.open('sess_1'))
    post(
      {
        type: 'strimz:checkout:error',
        sessionId: 'sess_1',
        code: 'unsupported_wallet',
        message: 'Connect a regular wallet.',
      },
      popup,
    )
    const error = onError.mock.calls[0]?.[0] as StrimzCheckoutError
    expect(error).toBeInstanceOf(StrimzCheckoutError)
    expect(error.code).toBe('unsupported_wallet')
    expect(error.sessionId).toBe('sess_1')
    expect(error.message).toBe('Connect a regular wallet.')
  })

  it('ignores a success from another window on the checkout origin', () => {
    const onSuccess = vi.fn()
    const { hook } = setup({ onSuccess })
    act(() => hook.result.current.open('sess_1'))
    post({ type: 'strimz:checkout:success', sessionId: 'sess_1', txHash }, fakePopup())
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('ignores a success from another origin', () => {
    const onSuccess = vi.fn()
    const { popup, hook } = setup({ onSuccess })
    act(() => hook.result.current.open('sess_1'))
    post(
      { type: 'strimz:checkout:success', sessionId: 'sess_1', txHash },
      popup,
      'https://evil.example',
    )
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('ignores a success for a different session', () => {
    const onSuccess = vi.fn()
    const { popup, hook } = setup({ onSuccess })
    act(() => hook.result.current.open('sess_1'))
    post({ type: 'strimz:checkout:success', sessionId: 'sess_2', txHash }, popup)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('ignores a message outside the schema', () => {
    const onSuccess = vi.fn()
    const { popup, hook } = setup({ onSuccess })
    act(() => hook.result.current.open('sess_1'))
    post({ type: 'strimz:checkout:success', sessionId: 'sess_1', txHash: 'nope' }, popup)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
