import { describe, expect, it } from 'vitest'
import { firstRunSteps, type FirstRunPath } from '../first-run'

function path(id: FirstRunPath['id'], progress = { created: false, paid: false }): FirstRunPath {
  const found = firstRunSteps(progress).find((p) => p.id === id)
  if (!found) throw new Error(`no ${id} path`)
  return found
}

describe('first-run checklist', () => {
  it('puts the no-code path first', () => {
    const paths = firstRunSteps({ created: false, paid: false })
    expect(paths.map((p) => p.id)).toEqual(['no-code', 'developer'])
  })

  it('never sends the no-code path to API keys', () => {
    const noCode = path('no-code')
    for (const step of noCode.steps) expect(step.href).not.toMatch(/api-keys/u)
    expect(noCode.steps[0]?.href).toBe('/app/payment-sessions?new=1')
  })

  it('keeps the developer path as API key, test payment, webhook', () => {
    const developer = path('developer')
    expect(developer.steps.map((s) => s.href)).toEqual([
      '/app/api-keys',
      '/app/payment-sessions',
      '/app/webhooks',
    ])
  })

  it('ticks steps off from progress', () => {
    const done = (p: { created: boolean; paid: boolean }) =>
      path('no-code', p).steps.map((s) => s.done)
    expect(done({ created: false, paid: false })).toEqual([false, false, false])
    expect(done({ created: true, paid: false })).toEqual([true, false, false])
    expect(done({ created: true, paid: true })).toEqual([true, true, true])
  })
})
