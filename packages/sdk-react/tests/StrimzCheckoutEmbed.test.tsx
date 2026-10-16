import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { StrimzCheckoutEmbed, StrimzProvider } from '../src/index.js'

const validKey = 'pk_test_' + 'a'.repeat(20)

function iframeSrc(node: React.ReactNode): URL {
  render(
    <StrimzProvider publishableKey={validKey} checkoutOrigin="https://strimz.example">
      {node}
    </StrimzProvider>,
  )
  return new URL(screen.getByTitle('Strimz checkout').getAttribute('src') ?? '')
}

describe('<StrimzCheckoutEmbed/> theme', () => {
  it('passes the requested theme to the hosted checkout', () => {
    const src = iframeSrc(<StrimzCheckoutEmbed sessionId="sess_1" theme="dark" />)
    expect(src.pathname).toBe('/pay/sess_1')
    expect(src.searchParams.get('embed')).toBe('1')
    expect(src.searchParams.get('theme')).toBe('dark')
  })

  it('passes light the same way', () => {
    const src = iframeSrc(<StrimzCheckoutEmbed sessionId="sess_1" theme="light" />)
    expect(src.searchParams.get('theme')).toBe('light')
  })

  it('omits the parameter so the checkout follows the payer system preference', () => {
    const src = iframeSrc(<StrimzCheckoutEmbed sessionId="sess_1" />)
    expect(src.searchParams.has('theme')).toBe(false)
  })
})

describe('<StrimzCheckoutEmbed/> results', () => {
  const txHash = `0x${'ab'.repeat(32)}`

  function mount(handlers: { onSuccess?: () => void; onCancel?: () => void }) {
    render(
      <StrimzProvider publishableKey={validKey} checkoutOrigin="https://strimz.example">
        <StrimzCheckoutEmbed sessionId="sess_1" {...handlers} />
      </StrimzProvider>,
    )
    return screen.getByTitle('Strimz checkout') as HTMLIFrameElement
  }

  function post(data: unknown, source: unknown, origin = 'https://strimz.example') {
    const ev = new MessageEvent('message', { data, origin })
    Object.defineProperty(ev, 'source', { value: source })
    act(() => {
      window.dispatchEvent(ev)
    })
  }

  it('tells the checkout which page to answer', () => {
    const src = iframeSrc(<StrimzCheckoutEmbed sessionId="sess_1" />)
    expect(src.searchParams.get('parent')).toBe(window.location.origin)
  })

  it('calls onSuccess for a message from its own frame', () => {
    const onSuccess = vi.fn()
    const frame = mount({ onSuccess })
    post({ type: 'strimz:checkout:success', sessionId: 'sess_1', txHash }, frame.contentWindow)
    expect(onSuccess).toHaveBeenCalledWith(txHash)
  })

  it('calls onCancel for a cancel from its own frame', () => {
    const onCancel = vi.fn()
    const frame = mount({ onCancel })
    post({ type: 'strimz:checkout:cancel', sessionId: 'sess_1' }, frame.contentWindow)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ignores the same message from another window', () => {
    const onSuccess = vi.fn()
    mount({ onSuccess })
    post({ type: 'strimz:checkout:success', sessionId: 'sess_1', txHash }, window)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('ignores a message for another session', () => {
    const onSuccess = vi.fn()
    const frame = mount({ onSuccess })
    post({ type: 'strimz:checkout:success', sessionId: 'sess_2', txHash }, frame.contentWindow)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
