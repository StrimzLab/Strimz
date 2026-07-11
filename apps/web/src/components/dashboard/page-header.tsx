import Link from 'next/link'
import type { ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'

export function PageHeader({
  title,
  description,
  action,
  badge,
  docsSlug,
}: {
  title: string
  description?: string
  action?: ReactNode
  badge?: ReactNode
  /** Slug under /docs/dashboard/ — renders a small help link next to the title. */
  docsSlug?: string
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h2 className="font-sora text-2xl font-bold tracking-tight">{title}</h2>
          {badge}
          {docsSlug ? (
            <Link
              href={`/docs/dashboard/${docsSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
              aria-label={`Learn about ${title}`}
            >
              <HelpCircle className="size-3.5" />
              <span className="hidden sm:inline">Learn</span>
            </Link>
          ) : null}
        </div>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
