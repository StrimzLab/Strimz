'use client'

import * as React from 'react'
import { cn } from '../lib/cn'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

/**
 * Strimz Input — explicit light-mode styling. Brand-green focus ring
 * with a soft outer glow, no dark token fallback.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'font-poppins border-border bg-card text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-colors',
          'placeholder:text-muted-foreground',
          'file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'focus-visible:border-accent focus-visible:ring-accent/15 focus-visible:outline-none focus-visible:ring-4',
          'disabled:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-rose-500 aria-invalid:ring-rose-500/15',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
