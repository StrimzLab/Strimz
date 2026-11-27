'use client'

import { FlaskConical } from 'lucide-react'
import { useDashboardMode } from '@strimz/web-shared/lib/dashboard-mode'
import { siteUrls } from '@strimz/web-shared/lib/site-urls'

export function TestModeBanner() {
  if (useDashboardMode() !== 'test') return null
  return (
    <div
      role="status"
      className="border-warning-border bg-warning-surface text-warning flex items-start gap-2 border-b px-4 py-2 text-xs sm:items-center sm:px-6"
    >
      <FlaskConical className="mt-px size-3.5 shrink-0 sm:mt-0" aria-hidden />
      <p>
        <span className="font-semibold">Test mode.</span> Payments use testnet USDC from the faucet.
        Nothing here touches real money.{' '}
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
