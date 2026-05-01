import Link from 'next/link'
import { cn } from '@strimz/ui'

/**
 * Strimz wordmark + glyph. Pure SVG (no Image) so it inherits theme
 * colours and renders identically across light/dark without a flash.
 */
export function Logo({
  href = '/',
  className,
  variant = 'auto',
}: {
  href?: string
  className?: string
  variant?: 'auto' | 'mono-light' | 'mono-dark'
}) {
  const wordmark = cn(
    'text-lg font-semibold tracking-tight',
    variant === 'mono-light' && 'text-white',
    variant === 'mono-dark' && 'text-[#050020]',
  )
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2', className)}>
      <Glyph className="h-7 w-7" />
      <span className={wordmark}>Strimz</span>
    </Link>
  )
}

export function Glyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn('text-[#02C76A]', className)}
    >
      <defs>
        <linearGradient id="strimz-glyph-grad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#02C76A" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <path
        d="M6 8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H10a4 4 0 0 0-4 4v3a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4"
        stroke="url(#strimz-glyph-grad)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
