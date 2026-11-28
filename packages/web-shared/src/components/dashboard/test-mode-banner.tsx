'use client'

import type { ReactNode } from 'react'
import { FlaskConical } from 'lucide-react'
import { useDashboardMode } from '../../lib/dashboard-mode'
import { siteUrls } from '../../lib/site-urls'

/** Shown in test mode only. `children` says what test mode means in this app. */
export function TestModeBanner({ children }: { children: ReactNode }) {
  if (useDashboardMode() !== 'test') return null
  return (
    <div
      role="status"
      data-tour="test-banner"
      className="border-warning-border bg-warning-surface text-warning flex items-start gap-2 border-b px-4 py-2 text-xs sm:items-center sm:px-6"
    >
      <FlaskConical className="mt-px size-3.5 shrink-0 sm:mt-0" aria-hidden />
      <p>
        <span className="font-semibold">Test mode.</span> {children}{' '}
        <a
          href={`${siteUrls.docs}/docs/testing`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2"
        >
          How test mode works
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  )
}
