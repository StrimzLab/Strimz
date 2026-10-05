'use client'

import * as React from 'react'
import { cn } from '../lib/cn'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

/**
 * Strimz Textarea — same focus treatment as Input (brand-green ring,
 * soft glow, no dark token fallback).
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'font-poppins border-border bg-card text-foreground flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm transition-colors',
          'placeholder:text-muted-foreground',
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
Textarea.displayName = 'Textarea'
