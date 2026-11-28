import Link from 'next/link'
import type { ComponentProps } from 'react'
import { isDocsUrl } from '@strimz/web-shared/lib/site-urls'

/** Next's Link, except docs links open in a new tab so visitors keep their place (#585). */
export function SiteLink({ children, ...props }: ComponentProps<typeof Link>) {
  if (typeof props.href !== 'string' || !isDocsUrl(props.href)) {
    return <Link {...props}>{children}</Link>
  }
  return (
    <Link target="_blank" rel="noopener noreferrer" {...props}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  )
}
