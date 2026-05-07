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
    'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#02C76A]/40 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-[#02C76A] text-white shadow-[0_-4px_4px_0_rgba(0,0,0,0.2)_inset,_0_4px_4px_0_rgba(225,225,225,0.25)_inset] hover:bg-[#02b35e]',
        navy: 'bg-[#050020] text-white hover:bg-[#0a0530]',
        secondary:
          'border border-[#E5E7EB] bg-[#F9FAFB] text-[#050020] hover:border-[#050020] hover:bg-white',
        outline:
          'border border-[#E5E7EB] bg-white text-[#050020] hover:border-[#050020] hover:bg-white',
        ghost: 'text-[#050020] hover:bg-[#F9FAFB]',
        link: 'text-[#02C76A] underline-offset-4 hover:underline',
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
