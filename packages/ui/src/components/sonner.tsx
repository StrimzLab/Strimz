'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useResolvedTheme } from './theme-provider'

/**
 * Strimz toast — hardcoded `theme="light"`. Sonner reads `prefers-color-scheme`
 * by default and goes dark on Mac/Windows users with dark system mode, which
 * is wrong for Strimz (light-mode only).
 */
export function Toaster({ ...props }: ToasterProps) {
  const resolved = useResolvedTheme()
  return (
    <Sonner
      theme={resolved ?? 'system'}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast !bg-popover !text-foreground !border !border-border !shadow-[0_18px_40px_-15px_rgba(5,0,32,0.18)] font-poppins',
          title: '!text-foreground !font-[600]',
          description: '!text-muted-foreground',
          actionButton: '!bg-accent !text-white',
          cancelButton: '!bg-muted !text-muted-foreground',
          success: '!text-foreground',
          error: '!text-foreground',
        },
      }}
      {...props}
    />
  )
}

export { toast } from 'sonner'
