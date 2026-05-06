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
          'flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 font-poppins text-sm text-[#050020] transition-colors',
          'placeholder:text-[#8E8C9C]',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#050020]',
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
Input.displayName = 'Input'
