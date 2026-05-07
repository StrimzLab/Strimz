import type { ReactNode } from 'react'
import { cn } from '@strimz/ui'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-border/60 bg-muted/10 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center',
        className,
      )}
    >
      <div className="shadow-sub-icon mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-[#02C76A]/10 text-[#02C76A]">
        <Icon className="size-5" />
      </div>
      <h3 className="font-poppins text-base font-semibold">{title}</h3>
      {description && <p className="text-muted-foreground mt-2 max-w-md text-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
