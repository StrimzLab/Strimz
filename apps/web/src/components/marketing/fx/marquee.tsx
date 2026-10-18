import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@strimz/ui'

// Content is rendered twice so the loop is seamless; the copy is hidden from assistive tech.
export function Marquee({
  children,
  reverse = false,
  duration = 40,
  className,
}: {
  children: ReactNode
  reverse?: boolean
  duration?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]',
        className,
      )}
    >
      <div
        style={{ '--marquee-duration': `${duration}s` } as CSSProperties}
        className={cn(
          'flex w-max shrink-0 group-hover:[animation-play-state:paused]',
          reverse ? 'animate-marquee-reverse' : 'animate-marquee',
        )}
      >
        <div className="flex shrink-0 gap-3 pr-3">{children}</div>
        <div aria-hidden className="flex shrink-0 gap-3 pr-3">
          {children}
        </div>
      </div>
    </div>
  )
}
