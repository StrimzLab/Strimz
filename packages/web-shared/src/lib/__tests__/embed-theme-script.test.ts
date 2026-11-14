import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { embedForcedThemeFromSearch, embedThemeScript, isEmbeddablePath } from '../theme'

function runScript(search: string, initial: string[]) {
  const classes = new Set(initial)
  const style: { colorScheme?: string } = {}
  const documentElement = {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
    },
    style,
  }
  runInNewContext(embedThemeScript(), {
    URLSearchParams,
    window: { location: { search } },
    document: { documentElement },
  })
  return { classes: [...classes].sort(), colorScheme: style.colorScheme }
}

describe('embedThemeScript', () => {
  it.each([
    '?embed=1&theme=dark',
    '?embed=1&theme=light',
    '?theme=dark&embed=1&theme=light',
    '?embed=1',
    '?embed=1&theme=system',
    '?embed=0&theme=dark',
    '?theme=dark',
    '',
  ])('agrees with embedForcedThemeFromSearch for %j', (search) => {
    const forced = embedForcedThemeFromSearch(search)
    const result = runScript(search, ['light'])
    if (forced) {
      expect(result).toEqual({ classes: [forced], colorScheme: forced })
    } else {
      expect(result).toEqual({ classes: ['light'], colorScheme: undefined })
    }
  })

  it('replaces the theme class the stored preference applied', () => {
    expect(runScript('?embed=1&theme=light', ['dark', 'font'])).toEqual({
      classes: ['font', 'light'],
      colorScheme: 'light',
    })
  })
})

describe('isEmbeddablePath', () => {
  it.each([
    ['/pay/sess_1', true],
    ['/sub/plan_1', true],
    ['/payments', false],
    ['/app/pay/x', false],
    ['/', false],
  ])('%s is %s', (path, expected) => {
    expect(isEmbeddablePath(path)).toBe(expected)
  })
})
