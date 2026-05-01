import type { ReactNode } from 'react'
import { cn } from '@strimz/ui'

/**
 * Centred container with a 1440px ceiling. Marketing surfaces use this
 * directly; dashboard surfaces nest inside the sidebar layout and
 * generally don't need it.
 */
export function MaxWrapper({
  children,
  className,
  as: As = 'div',
}: {
  children: ReactNode
  className?: string
  as?: keyof React.JSX.IntrinsicElements
}) {
  const Component = As as React.ElementType
  return (
    <Component className={cn('mx-auto w-full max-w-[1440px]', className)}>
      {children}
    </Component>
  )
}
