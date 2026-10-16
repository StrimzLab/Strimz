import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

/**
 * Strimz Badge — concrete colors per variant. Default = soft brand
 * accent (green-tinted), so a `<Badge>` reads as on-brand without any
 * extra props.
 */
const badgeVariants = cva(
  'font-poppins inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-[500] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-accent/30 bg-accent/10 text-accent',
        solid: 'bg-accent border-transparent text-white',
        navy: 'bg-primary text-primary-foreground border-transparent',
        secondary: 'bg-muted text-muted-foreground border-transparent',
        outline: 'border-border bg-card text-foreground',
        success: 'bg-accent border-transparent text-white',
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
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
