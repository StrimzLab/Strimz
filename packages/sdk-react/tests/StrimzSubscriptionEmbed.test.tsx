import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { StrimzProvider, StrimzSubscriptionEmbed } from '../src/index.js'

const validKey = 'pk_test_' + 'a'.repeat(20)
const CHECKOUT = 'https://strimz.example'
const txHash = `0x${'ab'.repeat(32)}`

function mount(node: React.ReactNode) {
  render(
    <StrimzProvider publishableKey={validKey} checkoutOrigin={CHECKOUT}>
      {node}
    </StrimzProvider>,
  )
  return screen.getByTitle('Strimz subscription checkout') as HTMLIFrameElement
}

function post(data: unknown, source: unknown, origin = CHECKOUT) {
  const ev = new MessageEvent('message', { data, origin })
  Object.defineProperty(ev, 'source', { value: source })
  act(() => {
    window.dispatchEvent(ev)
  })
}

describe('<StrimzSubscriptionEmbed/>', () => {
  it('embeds the plan checkout with its parent and theme', () => {
    const frame = mount(<StrimzSubscriptionEmbed planId="plan_1" theme="dark" />)
    const src = new URL(frame.getAttribute('src') ?? '')
    expect(src.origin + src.pathname).toBe(`${CHECKOUT}/sub/plan_1`)
    expect(src.searchParams.get('embed')).toBe('1')
    expect(src.searchParams.get('parent')).toBe(window.location.origin)
    expect(src.searchParams.get('theme')).toBe('dark')
  })

  it('calls onSuccess and onCancel for messages from its own frame', () => {
    const onSuccess = vi.fn()
    const onCancel = vi.fn()
    const frame = mount(
      <StrimzSubscriptionEmbed planId="plan_1" onSuccess={onSuccess} onCancel={onCancel} />,
    )
    post(
      { type: 'strimz:subscription:success', planId: 'plan_1', subscriptionId: 'sub_1', txHash },
      frame.contentWindow,
    )
    post({ type: 'strimz:subscription:cancel', planId: 'plan_1' }, frame.contentWindow)
    expect(onSuccess).toHaveBeenCalledWith({ subscriptionId: 'sub_1', txHash })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('ignores the same message from another window or for another plan', () => {
    const onSuccess = vi.fn()
    const frame = mount(<StrimzSubscriptionEmbed planId="plan_1" onSuccess={onSuccess} />)
    const ok = {
      type: 'strimz:subscription:success',
      planId: 'plan_1',
      subscriptionId: 'sub_1',
      txHash,
    }
    post(ok, window)
    post({ ...ok, planId: 'plan_2' }, frame.contentWindow)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
