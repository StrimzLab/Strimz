import type { ReactNode } from 'react'
import { Toaster } from '@strimz/ui'
import { ThemeProvider } from './theme/theme-provider'
import { fontVariables } from '../lib/fonts'
import { THEME_STORAGE_KEY } from '../lib/theme'
import { STALE_ASSET_GUARD_SCRIPT } from '../lib/stale-asset-guard'
import '../styles/globals.css'

export function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <body className="bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: STALE_ASSET_GUARD_SCRIPT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey={THEME_STORAGE_KEY}
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
