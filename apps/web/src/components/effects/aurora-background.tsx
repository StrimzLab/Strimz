import { cn } from '@strimz/ui'

/**
 * Animated aurora backdrop. Three soft-radial blobs (green / cyan /
 * violet) drift through their viewport. Honours
 * `prefers-reduced-motion`. Pair with `AuroraGrid` for the full
 * marketing hero feel.
 */
export function AuroraBackground({
  className,
  variant = 'soft',
}: {
  className?: string
  variant?: 'soft' | 'bold'
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 strimz-aurora strimz-aurora-animated',
        variant === 'bold' ? 'opacity-90' : 'opacity-60',
        className,
      )}
    />
  )
}

export function AuroraGrid({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 strimz-grid-bg opacity-40', className)} />
  )
}
