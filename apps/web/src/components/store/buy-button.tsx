'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, ShoppingBag } from 'lucide-react'
import { Button, FieldLabel, Input } from '@strimz/ui'
import type { StorefrontCheckoutResponse } from '@strimz/shared-types'
import { env } from '@/lib/env'
import { storefrontCheckoutError } from '@/lib/payer-errors'

interface BuyButtonProps {
  slug: string
  productId: string
  currency: string
  priceLabel: string
  productType: 'one_time' | 'subscription'
}

/** Calls the public API directly (no BFF hop), then sends the buyer to hosted checkout. */
export function BuyButton({ slug, productId, currency, priceLabel, productType }: BuyButtonProps) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      const res = await fetch(
        `${env.apiUrl.replace(/\/$/, '')}/store/${encodeURIComponent(slug)}/products/${encodeURIComponent(productId)}/checkout`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...(email ? { customerEmail: email } : {}),
          }),
        },
      )
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string }
        } | null
        console.error('[storefront checkout]', res.status, detail?.error?.message)
        toast.error(storefrontCheckoutError(detail?.error?.code ?? null))
        setBusy(false)
        return
      }
      const body = (await res.json()) as StorefrontCheckoutResponse
      window.location.assign(body.checkoutUrl)
    } catch (err) {
      console.error('[storefront checkout]', err)
      toast.error(storefrontCheckoutError(null))
      setBusy(false)
    }
  }

  const cta =
    productType === 'subscription'
      ? `Subscribe for ${priceLabel} ${currency}`
      : `Pay ${priceLabel} ${currency}`

  return (
    <div className="space-y-3">
      <div>
        <FieldLabel htmlFor="buy-email" required={false} className="text-muted-foreground text-xs">
          Email for your receipt
        </FieldLabel>
        <Input
          id="buy-email"
          type="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1"
        />
      </div>
      <Button className="w-full" size="lg" onClick={handleClick} disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Opening checkout…
          </>
        ) : (
          <>
            <ShoppingBag className="mr-2 size-4" />
            {cta}
          </>
        )}
      </Button>
      <p className="font-poppins text-muted-foreground text-center text-xs">Powered by Strimz</p>
    </div>
  )
}
