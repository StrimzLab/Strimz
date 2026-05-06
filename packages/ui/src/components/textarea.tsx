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
          'flex min-h-[80px] w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 font-poppins text-sm text-[#050020] transition-colors',
          'placeholder:text-[#8E8C9C]',
          'focus-visible:outline-none focus-visible:border-[#02C76A] focus-visible:ring-4 focus-visible:ring-[#02C76A]/15',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#F9FAFB]',
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
