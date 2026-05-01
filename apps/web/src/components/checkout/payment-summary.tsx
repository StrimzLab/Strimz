'use client'

import Link from 'next/link'
import { Logo, Glyph } from '@/components/shared/logo'
import { Repeat } from 'lucide-react'

export interface SummaryProps {
  merchantName?: string
  amount?: string
  currency?: string
  description?: string
  interval?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
}

/**
 * Left-rail payment summary. Stays static during the checkout step
 * machine on the right — anchors the eye and reduces "did I just pay?"
 * anxiety.
 */
export function PaymentSummary({
  merchantName,
  amount,
  currency = 'USDC',
  description,
  interval,
}: SummaryProps) {
  const merchantInitial = merchantName?.charAt(0).toUpperCase() || 'S'

  return (
    <aside className="flex h-full flex-col">
      <div className="strimz-card-shadow flex flex-1 flex-col gap-10 rounded-2xl bg-muted/30 p-8">
        {/* Merchant identity */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#02C76A] font-sora text-base font-semibold text-white">
            {merchantInitial}
          </div>
          <h4 className="font-poppins text-base font-medium md:text-lg">
            {merchantName ?? 'Loading…'}
          </h4>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Total amount
          </div>
          <div className="flex items-center gap-2.5">
            <div className="strimz-sub-icon-shadow flex size-8 items-center justify-center rounded-full bg-background">
              <span className="font-mono text-xs font-bold">{currency.charAt(0)}</span>
            </div>
            <h2 className="font-sora text-2xl font-bold md:text-3xl">
              {amount ?? '—'} {currency}
            </h2>
          </div>
          {interval && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Repeat className="size-3.5" />
              Charged every {interval.replace('ly', '')}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {description && (
            <div className="text-sm text-muted-foreground">{description}</div>
          )}
          <div className="border-t border-border/60" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total due</span>
            <span className="font-poppins text-sm font-semibold">
              {amount ?? '—'} {currency}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 hidden items-center justify-between text-xs text-muted-foreground md:flex">
        <div className="flex items-center gap-2">
          <span>Powered by</span>
          <Logo className="!gap-1.5 [&>span]:!text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/legal/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
        </div>
      </div>
    </aside>
  )
}

export function CheckoutPoweredBy() {
  return (
    <div className="flex flex-col items-center gap-3 pt-4 text-xs text-muted-foreground md:hidden">
      <div className="flex items-center gap-2">
        <span>Powered by</span>
        <Glyph className="size-4" />
        <span className="font-medium text-foreground">Strimz</span>
      </div>
    </div>
  )
}
