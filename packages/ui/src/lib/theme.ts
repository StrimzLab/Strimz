export type ResolvedTheme = 'light' | 'dark'

export function toggledTheme(resolved: ResolvedTheme): ResolvedTheme {
  return resolved === 'dark' ? 'light' : 'dark'
}

export function themeToggleLabel(resolved: ResolvedTheme): string {
  return `Switch to ${toggledTheme(resolved)} theme`
}
