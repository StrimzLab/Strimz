import type { ReactNode } from 'react'
import type { PayerError } from '@/lib/payer-errors'

const TONES = {
  error: 'border-danger-border bg-danger-surface text-danger',
  info: 'border-warning-border bg-warning-surface text-warning',
} as const

export function CheckoutNotice({
  tone = 'error',
  title,
  children,
}: {
  tone?: keyof typeof TONES
  title?: string
  children?: ReactNode
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-md border p-3 text-sm ${TONES[tone]}`}
    >
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-1 text-xs' : undefined}>{children}</div>}
    </div>
  )
}

export function PayerErrorNotice({ error, onRetry }: { error: PayerError; onRetry?: () => void }) {
  const act =
    error.action === 'refresh'
      ? { label: 'Refresh', run: () => window.location.reload() }
      : error.action === 'retry' && onRetry
        ? { label: 'Try again', run: onRetry }
        : null
  return (
    <CheckoutNotice title={error.title}>
      <p>{error.detail}</p>
      {act && (
        <button type="button" onClick={act.run} className="mt-2 font-medium underline">
          {act.label}
        </button>
      )}
    </CheckoutNotice>
  )
}

export function WalletConnectUnavailable() {
  return (
    <CheckoutNotice tone="info" title="Wallet connection isn't available right now">
      {process.env.NODE_ENV === 'development' && (
        <>
          Set <code>NEXT_PUBLIC_REOWN_PROJECT_ID</code>.
        </>
      )}
    </CheckoutNotice>
  )
}
