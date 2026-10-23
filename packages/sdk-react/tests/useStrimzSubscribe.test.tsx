import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import {
  StrimzProvider,
  StrimzSubscribeButton,
  StrimzSubscriptionError,
  useStrimzSubscribe,
  type UseStrimzSubscribeOptions,
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

function setup(options: UseStrimzSubscribeOptions = {}) {
  const popup = fakePopup()
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  const hook = renderHook(() => useStrimzSubscribe(options), {
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

describe('useStrimzSubscribe popup', () => {
  it('opens the plan checkout and says which page to answer', () => {
    const { open, hook } = setup()
    act(() => hook.result.current.open('plan_1'))
    const url = new URL(String(open.mock.calls[0]?.[0]))
    expect(url.origin + url.pathname).toBe(`${CHECKOUT}/sub/plan_1`)
    expect(url.searchParams.get('popup')).toBe('1')
    expect(url.searchParams.get('parent')).toBe(window.location.origin)
  })

  it('redirects to the plan checkout without host parameters', () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      origin: window.location.origin,
      assign,
    } as Location)
    const { hook } = setup({ mode: 'redirect' })
    act(() => hook.result.current.open('plan_1'))
    expect(assign).toHaveBeenCalledWith(`${CHECKOUT}/sub/plan_1`)
  })

  it('calls onSuccess with the subscription id and hash, and closes the popup', () => {
    const onSuccess = vi.fn()
    const { popup, hook } = setup({ onSuccess })
    act(() => hook.result.current.open('plan_1'))
    post(
      { type: 'strimz:subscription:success', planId: 'plan_1', subscriptionId: 'sub_1', txHash },
      popup,
    )
    expect(onSuccess).toHaveBeenCalledWith({ subscriptionId: 'sub_1', txHash })
    expect(popup.closed).toBe(true)
    expect(hook.result.current.status).toBe('success')
  })

  it('passes a null subscription id through', () => {
    const onSuccess = vi.fn()
    const { popup, hook } = setup({ onSuccess })
    act(() => hook.result.current.open('plan_1'))
    post(
      { type: 'strimz:subscription:success', planId: 'plan_1', subscriptionId: null, txHash },
      popup,
    )
    expect(onSuccess).toHaveBeenCalledWith({ subscriptionId: null, txHash })
  })

  it('calls onCancel once when the payer closes the popup', () => {
    const onCancel = vi.fn()
    const { popup, hook } = setup({ onCancel })
    act(() => hook.result.current.open('plan_1'))
    popup.closed = true
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(hook.result.current.status).toBe('cancelled')
  })

  it('passes the error code and plan to onError', () => {
    const onError = vi.fn()
    const { popup, hook } = setup({ onError })
    act(() => hook.result.current.open('plan_1'))
    post(
      {
        type: 'strimz:subscription:error',
        planId: 'plan_1',
        code: 'already_subscribed',
        message: 'This wallet already subscribes to this plan.',
      },
      popup,
    )
    const error = onError.mock.calls[0]?.[0] as StrimzSubscriptionError
    expect(error).toBeInstanceOf(StrimzSubscriptionError)
    expect(error.code).toBe('already_subscribed')
    expect(error.planId).toBe('plan_1')
  })

  it('ignores payment messages, other plans, other windows and other origins', () => {
    const onSuccess = vi.fn()
    const { popup, hook } = setup({ onSuccess })
    act(() => hook.result.current.open('plan_1'))
    const ok = {
      type: 'strimz:subscription:success',
      planId: 'plan_1',
      subscriptionId: 'sub_1',
      txHash,
    }
    post({ type: 'strimz:checkout:success', sessionId: 'plan_1', txHash }, popup)
    post({ ...ok, planId: 'plan_2' }, popup)
    post(ok, window)
    post(ok, popup, 'https://evil.example')
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('<StrimzSubscribeButton/>', () => {
  it('renders the default label and opens the plan in a popup', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(fakePopup() as unknown as Window)
    render(
      <StrimzProvider publishableKey={validKey} checkoutOrigin={CHECKOUT}>
        <StrimzSubscribeButton planId="plan_42" />
      </StrimzProvider>,
    )
    expect(screen.getByText(/Subscribe with Strimz/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(String(open.mock.calls[0]?.[0])).toContain('/sub/plan_42')
  })
})
