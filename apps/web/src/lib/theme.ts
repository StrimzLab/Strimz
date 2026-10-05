import type { ResolvedTheme } from '@strimz/ui/theme'

export { toggledTheme, themeToggleLabel, type ResolvedTheme } from '@strimz/ui/theme'

export const THEME_STORAGE_KEY = 'strimz-theme'
export const THEME_QUERY_PARAM = 'theme'
export const EMBED_QUERY_PARAM = 'embed'

export type ThemePreference = ResolvedTheme | 'system'

type QueryValue = string | string[] | null | undefined

export type EmbedThemeParams = Record<string, string | string[] | undefined>

const RESOLVED_THEMES: readonly ResolvedTheme[] = ['light', 'dark']

function firstValue(raw: QueryValue): string | null | undefined {
  return Array.isArray(raw) ? raw[0] : raw
}

export function parseThemeParam(raw: QueryValue): ResolvedTheme | null {
  const value = firstValue(raw)
  return RESOLVED_THEMES.find((theme) => theme === value) ?? null
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference !== 'system') return preference
  return systemPrefersDark ? 'dark' : 'light'
}

export function isEmbedded(raw: QueryValue): boolean {
  return firstValue(raw) === '1'
}

export function embedForcedTheme(params: EmbedThemeParams): ResolvedTheme | undefined {
  if (!isEmbedded(params[EMBED_QUERY_PARAM])) return undefined
  return parseThemeParam(params[THEME_QUERY_PARAM]) ?? undefined
}

export function embedForcedThemeFromSearch(search: string): ResolvedTheme | undefined {
  const query = new URLSearchParams(search)
  return embedForcedTheme({
    [EMBED_QUERY_PARAM]: query.get(EMBED_QUERY_PARAM) ?? undefined,
    [THEME_QUERY_PARAM]: query.get(THEME_QUERY_PARAM) ?? undefined,
  })
}

const EMBEDDABLE_PATH = /^\/(pay|sub)\//

export function isEmbeddablePath(pathname: string): boolean {
  return EMBEDDABLE_PATH.test(pathname)
}

export function embedThemeScript(): string {
  const allowed = RESOLVED_THEMES.filter(
    (theme) => embedForcedTheme({ [EMBED_QUERY_PARAM]: '1', [THEME_QUERY_PARAM]: theme }) === theme,
  )
  return [
    '(function(){',
    'var q=new URLSearchParams(window.location.search);',
    `var t=q.get(${JSON.stringify(THEME_QUERY_PARAM)});`,
    `if(q.get(${JSON.stringify(EMBED_QUERY_PARAM)})!=='1'||${JSON.stringify(allowed)}.indexOf(t)<0)return;`,
    'var d=document.documentElement;',
    `d.classList.remove(${allowed.map((theme) => JSON.stringify(theme)).join(',')});`,
    'd.classList.add(t);',
    'd.style.colorScheme=t;',
    '})()',
  ].join('')
}

export function privyAppearanceTheme(resolved: ResolvedTheme): ResolvedTheme {
  return resolved
}

export function reownThemeMode(resolved: ResolvedTheme): ResolvedTheme {
  return resolved
}

export type TurnstileTheme = ResolvedTheme | 'auto'

export function turnstileTheme(resolved: ResolvedTheme | undefined): TurnstileTheme {
  return resolved ?? 'auto'
}

export function asResolvedTheme(value: string | undefined): ResolvedTheme | undefined {
  return parseThemeParam(value) ?? undefined
}
