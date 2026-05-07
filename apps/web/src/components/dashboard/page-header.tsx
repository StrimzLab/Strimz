import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  action,
  badge,
}: {
  title: string
  description?: string
  action?: ReactNode
  badge?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h2 className="font-sora text-2xl font-bold tracking-tight">{title}</h2>
          {badge}
        </div>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
