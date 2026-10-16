import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { StrimzProvider, useStrimzCheckout, useStrimzContext } from '../src/index.js'

const validKey = 'pk_test_' + 'a'.repeat(20)
const WWW = 'https://www.strimz.finance'
const txHash = `0x${'ab'.repeat(32)}`

function openWith(checkoutOrigin: string | undefined, onSuccess = vi.fn()) {
  const popup = { closed: false, close: () => undefined }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  const hook = renderHook(() => useStrimzCheckout({ onSuccess }), {
    wrapper: ({ children }) => (
      <StrimzProvider publishableKey={validKey} checkoutOrigin={checkoutOrigin}>
        {children}
      </StrimzProvider>
    ),
  })
  act(() => hook.result.current.open('sess_1'))
  const url = new URL(String(open.mock.calls[0]?.[0]))
  return { popup, url, onSuccess }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkoutOrigin', () => {
  it('defaults to www, the host that serves the checkout', () => {
    const { url } = openWith(undefined)
    expect(url.origin + url.pathname).toBe(`${WWW}/pay/sess_1`)
  })

  it('accepts results from www by default', () => {
    const { popup, onSuccess } = openWith(undefined)
    const ev = new MessageEvent('message', {
      data: { type: 'strimz:checkout:success', sessionId: 'sess_1', txHash },
      origin: WWW,
    })
    Object.defineProperty(ev, 'source', { value: popup })
    act(() => {
      window.dispatchEvent(ev)
    })
    expect(onSuccess).toHaveBeenCalledWith(txHash)
  })

  it('drops a trailing slash', () => {
    const { url } = openWith(`${WWW}/`)
    expect(url.origin + url.pathname).toBe(`${WWW}/pay/sess_1`)
  })

  it('exposes the bare origin on the context', () => {
    const { result } = renderHook(() => useStrimzContext(), {
      wrapper: ({ children }) => (
        <StrimzProvider publishableKey={validKey} checkoutOrigin={`${WWW}/`}>
          {children}
        </StrimzProvider>
      ),
    })
    expect(result.current.checkoutOrigin).toBe(WWW)
  })

  it.each([`${WWW}/pay`, `${WWW}?a=1`, `${WWW}#top`, 'not a url'])('rejects %s', (value) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() =>
      render(
        <StrimzProvider publishableKey={validKey} checkoutOrigin={value}>
          <span />
        </StrimzProvider>,
      ),
    ).toThrow(/checkoutOrigin/)
    spy.mockRestore()
  })
})
