import type { CSSProperties } from 'react'
import { cn } from '@strimz/ui'

// Adapted from Vengeance UI's Border Beam (MIT): a light that runs around the parent's border.
export function BorderBeam({
  size = 160,
  duration = 9,
  delay = 0,
  className,
}: {
  size?: number
  duration?: number
  delay?: number
  className?: string
}) {
  return (
    <div
      aria-hidden
      style={
        {
          '--size': `${size}px`,
          '--duration': `${duration}s`,
          '--delay': `-${delay}s`,
        } as CSSProperties
      }
      className={cn(
        'beam pointer-events-none absolute inset-0 rounded-[inherit] [border:1.5px_solid_transparent]',
        '![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]',
        'after:absolute after:aspect-square after:w-[var(--size)] after:[animation:beam_var(--duration)_var(--delay)_infinite_linear] after:[background:linear-gradient(to_left,#95FECC,#02C76A,transparent)] after:[offset-anchor:90%_50%] after:[offset-path:rect(0_auto_auto_0_round_var(--size))]',
        className,
      )}
    />
  )
}
