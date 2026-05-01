'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@strimz/ui'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  /** Class for the small dot that expands on hover. */
  innerClassName?: string
}

/**
 * The Strimz signature CTA. A small dot expands to fill the button on
 * hover while the label slides out to the left and the new label +
 * icon slide in from the right. Built once, used on every primary CTA
 * across marketing, auth, and dashboard.
 *
 * Direct port of the prior `magicui/interactive-hover-button` with
 * cleaner typing and explicit `aria-label` support.
 */
export const InteractiveHoverButton = forwardRef<HTMLButtonElement, Props>(
  ({ children, className, icon, innerClassName, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'group relative w-auto cursor-pointer overflow-hidden p-2 px-6 text-center',
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-2 w-2 transition-all duration-300 group-hover:scale-[100.8]',
              innerClassName,
            )}
          />
          <span className="inline-block transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
            {children}
          </span>
        </div>
        <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
          <span>{children}</span>
          {icon}
        </div>
      </button>
    )
  },
)
InteractiveHoverButton.displayName = 'InteractiveHoverButton'
