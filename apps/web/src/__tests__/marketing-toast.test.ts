import { describe, expect, it } from 'vitest'
import { TOAST_LIMIT, toastReducer, type ToastItem } from '@/components/marketing/toast/store'

const item = (id: string, tone: ToastItem['tone'] = 'success'): ToastItem => ({
  id,
  tone,
  title: `Toast ${id}`,
  duration: 4000,
})

describe('toastReducer', () => {
  it('puts the newest toast first', () => {
    const state = toastReducer(toastReducer([], { type: 'add', toast: item('a') }), {
      type: 'add',
      toast: item('b'),
    })
    expect(state.map((t) => t.id)).toEqual(['b', 'a'])
  })

  it(`keeps at most ${TOAST_LIMIT} toasts, dropping the oldest`, () => {
    let state: ToastItem[] = []
    for (let i = 0; i < TOAST_LIMIT + 2; i++)
      state = toastReducer(state, { type: 'add', toast: item(String(i)) })
    expect(state).toHaveLength(TOAST_LIMIT)
    expect(state.at(-1)?.id).toBe('2')
  })

  it('replaces a toast that reuses an id instead of stacking it', () => {
    const state = toastReducer([item('copy')], {
      type: 'add',
      toast: { ...item('copy', 'error'), title: 'Copy failed' },
    })
    expect(state).toEqual([{ ...item('copy', 'error'), title: 'Copy failed' }])
  })

  it('dismisses by id and ignores unknown ids', () => {
    const state = [item('a'), item('b')]
    expect(toastReducer(state, { type: 'dismiss', id: 'a' }).map((t) => t.id)).toEqual(['b'])
    expect(toastReducer(state, { type: 'dismiss', id: 'zzz' })).toBe(state)
  })

  it('clears everything', () => {
    expect(toastReducer([item('a')], { type: 'clear' })).toEqual([])
  })
})
