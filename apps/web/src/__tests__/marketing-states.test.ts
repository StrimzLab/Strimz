import { describe, expect, it } from 'vitest'
import {
  canvasStatus,
  copyReducer,
  mediaReducer,
  type CopyState,
  type MediaState,
} from '@/components/marketing/state'
import { SectionBoundary } from '@/components/marketing/fx/section-boundary'

describe('canvasStatus', () => {
  it('waits while the canvas is being set up', () => {
    expect(canvasStatus({ phase: 'mounting', webgl: true, reducedMotion: false })).toBe('loading')
  })

  it('animates when WebGL is there and motion is allowed', () => {
    expect(canvasStatus({ phase: 'running', webgl: true, reducedMotion: false })).toBe('live')
  })

  it('draws one still frame under reduced motion', () => {
    expect(canvasStatus({ phase: 'running', webgl: true, reducedMotion: true })).toBe('still')
  })

  it('falls back to the poster without WebGL', () => {
    expect(canvasStatus({ phase: 'running', webgl: false, reducedMotion: false })).toBe(
      'unsupported',
    )
  })

  it('reports a failed setup or a lost context as an error', () => {
    expect(canvasStatus({ phase: 'failed', webgl: true, reducedMotion: false })).toBe('error')
  })
})

describe('copyReducer', () => {
  const idle: CopyState = { status: 'idle' }

  it('goes from idle to copying to copied', () => {
    const copying = copyReducer(idle, { type: 'start' })
    expect(copying).toEqual({ status: 'copying' })
    expect(copyReducer(copying, { type: 'done' })).toEqual({ status: 'copied' })
  })

  it('keeps the reason when the clipboard refuses', () => {
    const failed = copyReducer({ status: 'copying' }, { type: 'fail', reason: 'denied' })
    expect(failed).toEqual({ status: 'failed', reason: 'denied' })
  })

  it('resets to idle from any state', () => {
    expect(copyReducer({ status: 'copied' }, { type: 'reset' })).toEqual(idle)
    expect(copyReducer({ status: 'failed', reason: 'x' }, { type: 'reset' })).toEqual(idle)
  })

  it('ignores a late result once it has been reset', () => {
    expect(copyReducer(idle, { type: 'done' })).toEqual(idle)
    expect(copyReducer(idle, { type: 'fail', reason: 'late' })).toEqual(idle)
  })
})

describe('mediaReducer', () => {
  const loading: MediaState = 'loading'

  it('loads, then shows', () => {
    expect(mediaReducer(loading, 'load')).toBe('loaded')
  })

  it('shows the fallback when the file fails', () => {
    expect(mediaReducer(loading, 'error')).toBe('failed')
  })

  it('does not flip back once settled', () => {
    expect(mediaReducer('loaded', 'error')).toBe('loaded')
    expect(mediaReducer('failed', 'load')).toBe('failed')
  })
})

describe('SectionBoundary', () => {
  it('moves to the failed state when a child throws', () => {
    const error = new Error('chunk failed')
    expect(SectionBoundary.getDerivedStateFromError(error)).toEqual({ error })
  })
})
