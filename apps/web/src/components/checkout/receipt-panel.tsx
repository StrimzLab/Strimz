'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { arcExplorerTxUrl } from '@strimz/shared-config'
import { SubmitButton } from '@/components/auth/submit-button'
import { env } from '@/lib/env'
import type { CheckoutHostMode } from '@/lib/checkout-result'

export interface ReceiptRow {
  label: string
  value: string
}

const REDIRECT_AFTER_SECONDS = 8
const POPUP_CLOSE_HINT_MS = 2_000

/**
 * Only the full page redirects. Popup and embed stay put: the merchant
 * page already has the result. No "merchant notified" line, since we
 * can't know a webhook was delivered.
 */
export function ReceiptPanel({
  title,
  rows,
  note,
  txHash,
  merchantName,
  returnUrl,
  hostMode,
}: {
  title: string
  rows: ReceiptRow[]
  note?: string | null
  txHash: string | null
  merchantName?: string | null
  returnUrl: string | null
  hostMode: CheckoutHostMode
}) {
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_AFTER_SECONDS)
  const [showCloseHint, setShowCloseHint] = useState(hostMode === 'page')

  useEffect(() => {
    if (!returnUrl) return
    if (secondsLeft <= 0) {
      window.location.href = returnUrl
      return
    }
    const t = window.setTimeout(() => setSecondsLeft((n) => n - 1), 1_000)
    return () => window.clearTimeout(t)
  }, [secondsLeft, returnUrl])

  useEffect(() => {
    if (hostMode !== 'popup') return
    const t = window.setTimeout(() => setShowCloseHint(true), POPUP_CLOSE_HINT_MS)
    return () => window.clearTimeout(t)
  }, [hostMode])

  const merchant = merchantName || 'the merchant'

  return (
    <div className="border-accent/30 bg-accent/5 rounded-xl border px-5 py-6">
      <div className="flex flex-col items-center text-center">
        <div className="bg-accent/15 text-accent flex size-12 items-center justify-center rounded-full">
          <svg
            viewBox="0 0 24 24"
            className="receipt-check size-7"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h3 className="font-poppins text-foreground mt-3 text-base font-semibold tracking-tight">
          {title}
        </h3>
      </div>

      <dl className="border-border bg-background mt-5 divide-y rounded-md border text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 px-3 py-2">
            <dt className="text-muted-foreground shrink-0">{row.label}</dt>
            <dd className="text-foreground text-right font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>

      {note && <p className="text-muted-foreground mt-3 text-center text-xs">{note}</p>}

      {txHash && (
        <a
          href={arcExplorerTxUrl(env.arcEnvironment, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:text-accent mt-4 flex items-center justify-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline"
        >
          View receipt on Arc explorer
          <ExternalLink className="size-3" />
        </a>
      )}

      {returnUrl ? (
        <div className="mt-5 space-y-3">
          <p className="text-muted-foreground text-center text-xs">
            Returning to {merchant} in {secondsLeft}s…
          </p>
          <SubmitButton
            type="button"
            onClick={() => {
              window.location.href = returnUrl
            }}
          >
            Return to {merchant}
            <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      ) : showCloseHint ? (
        <p className="text-muted-foreground mt-5 text-center text-xs">
          You can safely close this window.
        </p>
      ) : null}
    </div>
  )
}
