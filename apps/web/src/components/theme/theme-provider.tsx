'use client'

import { useLayoutEffect, useState } from 'react'
import { ThemeProvider as UiThemeProvider, type ThemeProviderProps } from '@strimz/ui'
import { embedForcedThemeFromSearch, isEmbeddablePath, type ResolvedTheme } from '@/lib/theme'

export function ThemeProvider(props: Omit<ThemeProviderProps, 'forcedTheme'>) {
  const [forcedTheme, setForcedTheme] = useState<ResolvedTheme>()

  useLayoutEffect(() => {
    if (!isEmbeddablePath(window.location.pathname)) return
    setForcedTheme(embedForcedThemeFromSearch(window.location.search))
  }, [])

  return <UiThemeProvider {...props} forcedTheme={forcedTheme} />
}
