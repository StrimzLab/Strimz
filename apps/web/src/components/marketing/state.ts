export type CanvasStatus = 'loading' | 'live' | 'still' | 'unsupported' | 'error'

export function canvasStatus(input: {
  phase: 'mounting' | 'running' | 'failed'
  webgl: boolean
  reducedMotion: boolean
}): CanvasStatus {
  if (input.phase === 'failed') return 'error'
  if (input.phase === 'mounting') return 'loading'
  if (!input.webgl) return 'unsupported'
  return input.reducedMotion ? 'still' : 'live'
}

export type CopyState =
  | { status: 'idle' }
  | { status: 'copying' }
  | { status: 'copied' }
  | { status: 'failed'; reason: string }

export type CopyEvent =
  | { type: 'start' }
  | { type: 'done' }
  | { type: 'fail'; reason: string }
  | { type: 'reset' }

export function copyReducer(state: CopyState, event: CopyEvent): CopyState {
  switch (event.type) {
    case 'start':
      return { status: 'copying' }
    case 'done':
      return state.status === 'copying' ? { status: 'copied' } : state
    case 'fail':
      return state.status === 'copying' ? { status: 'failed', reason: event.reason } : state
    case 'reset':
      return { status: 'idle' }
  }
}

export type MediaState = 'loading' | 'loaded' | 'failed'

export function mediaReducer(state: MediaState, event: 'load' | 'error'): MediaState {
  if (state !== 'loading') return state
  return event === 'load' ? 'loaded' : 'failed'
}
