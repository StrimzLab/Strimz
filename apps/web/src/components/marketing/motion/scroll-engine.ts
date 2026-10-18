export type ScrollEngine = {
  raf(time: number): void
  on(event: 'scroll', listener: () => void): void
  off(event: 'scroll', listener: () => void): void
  destroy(): void
}

type Ticker = {
  add(callback: (time: number) => void): void
  remove(callback: (time: number) => void): void
}

/** The ticker is attached in the same call that creates the engine, so it can never miss it. */
export function startSmoothScroll(deps: {
  create: () => ScrollEngine
  ticker: Ticker
  onScroll: () => void
}): () => void {
  const engine = deps.create()
  const update = (time: number) => engine.raf(time * 1000)
  engine.on('scroll', deps.onScroll)
  deps.ticker.add(update)
  return () => {
    deps.ticker.remove(update)
    engine.off('scroll', deps.onScroll)
    engine.destroy()
  }
}
