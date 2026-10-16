'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

/**
 * Strimz Button — light-mode variants with the brand green as the
 * default high-emphasis action. Concrete colors throughout, no token
 * indirection, no dark/light branching.
 */
const buttonVariants = cva(
  [
    'font-poppins inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-[500]',
    'focus-visible:ring-accent/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-accent hover:bg-accent-hover text-white shadow-[0_-4px_4px_0_rgba(0,0,0,0.2)_inset,_0_4px_4px_0_rgba(225,225,225,0.25)_inset]',
        navy: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary:
          'border-border bg-muted text-foreground hover:border-primary hover:bg-card border',
        outline: 'border-border bg-card text-foreground hover:border-primary hover:bg-card border',
        ghost: 'text-foreground hover:bg-muted',
        link: 'text-accent underline-offset-4 hover:underline',
        destructive: 'bg-rose-600 text-white hover:bg-rose-700',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
