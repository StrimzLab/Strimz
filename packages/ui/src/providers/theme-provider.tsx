'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

/**
 * Strimz's light/dark theme provider.
 * Wire this at the root of every Next.js app with the following defaults:
 *
 *   <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
