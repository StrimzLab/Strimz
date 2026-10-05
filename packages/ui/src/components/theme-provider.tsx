'use client'

import { useSyncExternalStore, type ComponentProps } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import type { ResolvedTheme } from '../lib/theme'

export type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>

export function ThemeProvider(props: ThemeProviderProps) {
  return <NextThemesProvider {...props} />
}

const subscribeToNothing = () => () => {}

export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  )
}

export function useResolvedTheme(): ResolvedTheme | undefined {
  const { forcedTheme, resolvedTheme } = useTheme()
  const mounted = useHasMounted()
  if (!mounted) return undefined
  const active = forcedTheme ?? resolvedTheme
  return active === 'light' || active === 'dark' ? active : undefined
}
