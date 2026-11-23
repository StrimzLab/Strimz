import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO } from './web-source'

const css = readFileSync(join(REPO, 'packages/web-shared/src/styles/globals.css'), 'utf8')
const tour = readFileSync(join(REPO, 'apps/dashboard/src/hooks/use-dashboard-tour.ts'), 'utf8')

function enclosingAtRules(source: string, index: number): string[] {
  const stack: string[] = []
  let start = 0
  for (let i = 0; i < index; i++) {
    if (source[i] === '{') {
      stack.push(source.slice(start, i).trim())
      start = i + 1
    } else if (source[i] === '}') {
      stack.pop()
      start = i + 1
    } else if (source[i] === ';') {
      start = i + 1
    }
  }
  return stack
}

describe('dashboard tour skin', () => {
  const rules = [...css.matchAll(/\.driver-popover[^{]*\.strimz-tour[^{]*\{/gu)]

  it('has rules for the tour popover', () => {
    expect(rules.length).toBeGreaterThan(0)
  })

  // driver.css is unlayered, so any layered rule loses to it and dark mode shows a white card.
  it('keeps every tour rule out of cascade layers', () => {
    for (const rule of rules) {
      const layers = enclosingAtRules(css, rule.index).filter((r) => r.startsWith('@layer'))
      expect(layers, rule[0]).toEqual([])
    }
  })

  it('describes live keys only', () => {
    expect(tour).not.toMatch(/test key/iu)
  })
})
