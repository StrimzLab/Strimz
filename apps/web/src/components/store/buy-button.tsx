'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, ShoppingBag } from 'lucide-react'
import { Button, Input, Label } from '@strimz/ui'
import type { StorefrontCheckoutResponse } from '@strimz/shared-types'
import { env } from '@/lib/env'

interface BuyButtonProps {
  slug: string
  productId: string
  currency: string
  priceLabel: string
  productType: 'one_time' | 'subscription'
}

/**
 * Public "Buy" button on the storefront + product-detail pages. On
 * click:
 *
 *   1. Optionally collects an email (so the buyer gets a receipt).
 *   2. POSTs to `${apiUrl}/store/:slug/products/:productId/checkout`.
 *   3. Redirects to the returned Strimz hosted-checkout URL.
 *
 * We hit the API directly (no BFF hop) because the endpoint is
 * `@Public()` on the backend. No cookies, no bearer token, just a
 * cross-origin fetch. CORS on apps/api already allows the marketing
 * origin.
 */
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
        const detail = await res
          .json()
          .catch(() => ({ error: { message: 'unexpected server error' } }))
        const message = detail?.error?.message ?? `Something went wrong (${res.status})`
        throw new Error(message)
      }
      const body = (await res.json()) as StorefrontCheckoutResponse
      window.location.assign(body.checkoutUrl)
    } catch (err) {
      toast.error((err as Error).message)
      setBusy(false)
    }
  }

  const cta =
    productType === 'subscription'
      ? `Subscribe · ${priceLabel} ${currency}`
      : `Buy · ${priceLabel} ${currency}`

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="buy-email" className="text-xs text-[#58556A]">
          Email (optional. For your receipt)
        </Label>
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
      <p className="font-poppins text-center text-[10px] text-[#58556A]">
        Powered by Strimz · Settles in ~13s on Arc
      </p>
    </div>
  )
}
