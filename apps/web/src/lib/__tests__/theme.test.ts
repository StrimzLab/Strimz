import { describe, expect, it } from 'vitest'
import {
  THEME_QUERY_PARAM,
  THEME_STORAGE_KEY,
  embedForcedTheme,
  parseThemeParam,
  privyAppearanceTheme,
  reownThemeMode,
  resolveTheme,
  themeToggleLabel,
  toggledTheme,
  turnstileTheme,
} from '../theme'

describe('theme constants', () => {
  it('persists the preference under one namespaced key shared by every surface', () => {
    expect(THEME_STORAGE_KEY).toBe('strimz-theme')
  })

  it('reads the embed override from the theme query parameter', () => {
    expect(THEME_QUERY_PARAM).toBe('theme')
  })
})

describe('parseThemeParam', () => {
  it.each([
    ['light', 'light'],
    ['dark', 'dark'],
  ] as const)('accepts %s', (raw, expected) => {
    expect(parseThemeParam(raw)).toBe(expected)
  })

  it.each([undefined, null, '', 'system', 'auto', 'DARK', ' dark', 'dark ', 'blue'])(
    'rejects %j',
    (raw) => {
      expect(parseThemeParam(raw)).toBeNull()
    },
  )

  it('takes the first value when the parameter is repeated', () => {
    expect(parseThemeParam(['dark', 'light'])).toBe('dark')
    expect(parseThemeParam(['nope', 'dark'])).toBeNull()
    expect(parseThemeParam([])).toBeNull()
  })
})

describe('resolveTheme', () => {
  it('honours an explicit preference regardless of the system setting', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('follows prefers-color-scheme when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('embedForcedTheme', () => {
  it('forces the theme the embedding merchant asked for', () => {
    expect(embedForcedTheme({ embed: '1', theme: 'dark' })).toBe('dark')
    expect(embedForcedTheme({ embed: '1', theme: 'light' })).toBe('light')
  })

  it('leaves the theme unforced when the parameter is absent or invalid', () => {
    expect(embedForcedTheme({ embed: '1' })).toBeUndefined()
    expect(embedForcedTheme({ embed: '1', theme: 'system' })).toBeUndefined()
    expect(embedForcedTheme({})).toBeUndefined()
  })

  it('ignores the theme parameter outside an embed so a shared link cannot pin a visitor', () => {
    expect(embedForcedTheme({ theme: 'dark' })).toBeUndefined()
  })
})

describe('toggle', () => {
  it('flips the resolved theme', () => {
    expect(toggledTheme('light')).toBe('dark')
    expect(toggledTheme('dark')).toBe('light')
  })

  it('names the action the button performs', () => {
    expect(themeToggleLabel('light')).toBe('Switch to dark theme')
    expect(themeToggleLabel('dark')).toBe('Switch to light theme')
  })
})

describe('third-party widget themes', () => {
  it('maps the resolved theme to Privy appearance.theme', () => {
    expect(privyAppearanceTheme('light')).toBe('light')
    expect(privyAppearanceTheme('dark')).toBe('dark')
  })

  it('maps the resolved theme to the Reown AppKit themeMode', () => {
    expect(reownThemeMode('light')).toBe('light')
    expect(reownThemeMode('dark')).toBe('dark')
  })

  it('lets Turnstile follow the browser until the theme has resolved on the client', () => {
    expect(turnstileTheme(undefined)).toBe('auto')
    expect(turnstileTheme('light')).toBe('light')
    expect(turnstileTheme('dark')).toBe('dark')
  })
})
