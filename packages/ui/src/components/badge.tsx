import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

/**
 * Strimz Badge — concrete colors per variant. Default = soft brand
 * accent (green-tinted), so a `<Badge>` reads as on-brand without any
 * extra props.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-poppins text-[11px] font-[500] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[#02C76A]/30 bg-[#02C76A]/10 text-[#02C76A]',
        solid: 'border-transparent bg-[#02C76A] text-white',
        navy: 'border-transparent bg-[#050020] text-white',
        secondary: 'border-transparent bg-[#F9FAFB] text-[#58556A]',
        outline: 'border-[#E5E7EB] bg-white text-[#050020]',
        success: 'border-transparent bg-[#02C76A] text-white',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
        destructive: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
