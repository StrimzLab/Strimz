import { describe, expect, it, vi } from 'vitest'
import { startSmoothScroll, type ScrollEngine } from '@/components/marketing/motion/scroll-engine'

function fakes() {
  const engine: ScrollEngine = { raf: vi.fn(), on: vi.fn(), off: vi.fn(), destroy: vi.fn() }
  const callbacks = new Set<(time: number) => void>()
  const ticker = {
    add: vi.fn((cb: (time: number) => void) => void callbacks.add(cb)),
    remove: vi.fn((cb: (time: number) => void) => void callbacks.delete(cb)),
  }
  const tick = (seconds: number) => callbacks.forEach((cb) => cb(seconds))
  return { engine, ticker, tick, callbacks }
}

describe('startSmoothScroll', () => {
  it('drives the engine from the ticker as soon as it starts', () => {
    const { engine, ticker, tick } = fakes()
    startSmoothScroll({ create: () => engine, ticker, onScroll: () => {} })
    tick(1.5)
    expect(engine.raf).toHaveBeenCalledWith(1500)
  })

  it('reports scroll to the listener', () => {
    const { engine, ticker } = fakes()
    const onScroll = () => {}
    startSmoothScroll({ create: () => engine, ticker, onScroll })
    expect(engine.on).toHaveBeenCalledWith('scroll', onScroll)
  })

  it('detaches and destroys the engine on stop', () => {
    const { engine, ticker, callbacks } = fakes()
    const stop = startSmoothScroll({ create: () => engine, ticker, onScroll: () => {} })
    stop()
    expect(callbacks.size).toBe(0)
    expect(engine.off).toHaveBeenCalled()
    expect(engine.destroy).toHaveBeenCalledTimes(1)
  })
})
