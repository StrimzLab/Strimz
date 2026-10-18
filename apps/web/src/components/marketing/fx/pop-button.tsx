import Link from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@strimz/ui'

// Adapted from Vengeance UI's Pop Button (MIT): https://github.com/Ashutoshx7/VengeanceUI

const SIZES = {
  sm: 'h-10 rounded-[11px] px-5 text-sm',
  md: 'h-11 rounded-xl px-5 text-sm',
  lg: 'h-[54px] rounded-[14px] px-7 text-[15px]',
} as const

type PopLinkProps = ComponentProps<typeof Link> & {
  tone?: 'primary' | 'neutral'
  size?: keyof typeof SIZES
  /** Set on the always-navy panels so the neutral key and focus ring stay readable. */
  onInk?: boolean
}

export function PopLink({
  tone = 'primary',
  size = 'lg',
  onInk = false,
  className,
  ...props
}: PopLinkProps) {
  return (
    <Link
      data-tone={tone === 'neutral' ? 'neutral' : undefined}
      data-size={size === 'sm' ? 'sm' : undefined}
      data-on-ink={onInk ? '' : undefined}
      className={cn(
        'pop-button font-poppins relative inline-flex select-none items-center justify-center gap-2 font-semibold',
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
