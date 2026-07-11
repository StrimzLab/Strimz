'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Logo, Glyph } from '@/components/shared/logo'
import { TokenLogo } from '@/components/shared/token-logo'
import { BlockieAvatar } from '@/components/dashboard/blockie-avatar'
import { Repeat } from 'lucide-react'

export interface SummaryProps {
  merchantName?: string
  merchantLogoUrl?: string | null
  merchantWalletAddress?: string | null
  amount?: string
  currency?: string
  description?: string
  interval?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
}

/**
 * Left-rail payment summary. Stays static during the checkout step
 * machine on the right. Anchors the eye and reduces "did I just pay?"
 * anxiety.
 */
export function PaymentSummary({
  merchantName,
  merchantLogoUrl,
  merchantWalletAddress,
  amount,
  currency = 'USDC',
  description,
  interval,
}: SummaryProps) {
  return (
    <aside className="flex h-full flex-col">
      <div className="shadow-sub-card bg-muted/30 flex flex-1 flex-col gap-10 rounded-2xl p-8">
        {/* Merchant identity: uploaded logo, else wallet blockie, else initial. */}
        <div className="flex items-center gap-3">
          <MerchantMark
            name={merchantName}
            logoUrl={merchantLogoUrl ?? null}
            walletAddress={merchantWalletAddress ?? null}
          />
          <h4 className="font-poppins text-base font-medium md:text-lg">
            {merchantName ?? 'Loading…'}
          </h4>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
            Total amount
          </div>
          <div className="flex items-center gap-2.5">
            <div className="shadow-sub-icon bg-background flex size-8 items-center justify-center rounded-full">
              <TokenLogo symbol={currency} size={20} />
            </div>
            <h2 className="font-sora text-2xl font-bold md:text-3xl">
              {amount ?? '—'} {currency}
            </h2>
          </div>
          {interval && (
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Repeat className="size-3.5" />
              Charged every {interval.replace('ly', '')}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {description && <div className="text-muted-foreground text-sm">{description}</div>}
          <div className="border-border/60 border-t" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total due</span>
            <span className="font-poppins text-sm font-semibold">
              {amount ?? '—'} {currency}
            </span>
          </div>
        </div>
      </div>

      <div className="text-muted-foreground mt-6 hidden items-center justify-between text-xs md:flex">
        <div className="flex items-center gap-2">
          <span>Powered by</span>
          <Logo className="!gap-1.5 [&>span]:!text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/legal/privacy"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/legal/terms"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Terms
          </Link>
        </div>
      </div>
    </aside>
  )
}

function MerchantMark({
  name,
  logoUrl,
  walletAddress,
}: {
  name?: string
  logoUrl: string | null
  walletAddress: string | null
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name ? `${name} logo` : 'Merchant logo'}
        width={40}
        height={40}
        className="size-10 rounded-full object-cover"
        unoptimized
      />
    )
  }
  if (walletAddress) {
    return <BlockieAvatar seed={walletAddress} size={40} className="rounded-full" />
  }
  return (
    <div className="font-sora flex size-10 items-center justify-center rounded-full bg-[#02C76A] text-base font-semibold text-white">
      {name?.charAt(0).toUpperCase() || 'S'}
    </div>
  )
}

export function CheckoutPoweredBy() {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 pt-4 text-xs md:hidden">
      <div className="flex items-center gap-2">
        <span>Powered by</span>
        <Glyph className="size-4" />
        <span className="text-foreground font-medium">Strimz</span>
      </div>
    </div>
  )
}
