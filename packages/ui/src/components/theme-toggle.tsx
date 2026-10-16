'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { cn } from '../lib/cn'
import { themeToggleLabel, toggledTheme } from '../lib/theme'
import { useResolvedTheme } from './theme-provider'

export interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { setTheme } = useTheme()
  const resolved = useResolvedTheme()
  const box = cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full', className)

  if (!resolved) return <span aria-hidden className={box} />

  const label = themeToggleLabel(resolved)

  return (
    <button
      type="button"
      onClick={() => setTheme(toggledTheme(resolved))}
      aria-label={label}
      title={label}
      className={cn(
        box,
        'border-border bg-card text-foreground hover:bg-muted focus-visible:ring-accent focus-visible:ring-offset-background border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      )}
    >
      {resolved === 'dark' ? (
        <Sun aria-hidden className="size-4" />
      ) : (
        <Moon aria-hidden className="size-4" />
      )}
    </button>
  )
}
