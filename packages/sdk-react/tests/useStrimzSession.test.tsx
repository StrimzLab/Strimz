import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { PaymentSession } from '@strimz/shared-types'

const session = vi.fn<(id: string) => Promise<PaymentSession>>()
const client = { checkout: { session } }

vi.mock('../src/hooks/useStrimzClient.js', () => ({
  useStrimzClient: () => client,
}))

const { useStrimzSession } = await import('../src/hooks/useStrimzSession.js')

function withStatus(status: PaymentSession['status']): PaymentSession {
  return { id: 'sess_1', status } as PaymentSession
}

beforeEach(() => {
  vi.useFakeTimers()
  session.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useStrimzSession', () => {
  it('stops polling once the session is confirmed', async () => {
    session
      .mockResolvedValueOnce(withStatus('awaiting_payment'))
      .mockResolvedValue(withStatus('confirmed'))
    const { result } = renderHook(() => useStrimzSession('sess_1', { pollIntervalMs: 1_000 }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(result.current.session?.status).toBe('confirmed')
    const callsAtConfirm = session.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(session.mock.calls.length).toBe(callsAtConfirm)
  })

  it('keeps polling while the session is open', async () => {
    session.mockResolvedValue(withStatus('awaiting_payment'))
    renderHook(() => useStrimzSession('sess_1', { pollIntervalMs: 1_000 }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })
    expect(session.mock.calls.length).toBe(4)
  })
})
