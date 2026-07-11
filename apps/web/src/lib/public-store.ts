import 'server-only'

import type { Storefront, StorefrontProduct } from '@strimz/shared-types'
import { env } from '@/lib/env'

/**
 * Server-side reads for the public hosted-storefront pages. These are
 * unauthenticated. The API's `GET /store/:slug` endpoint is public
 * and gated on the storefront's `published` status. We fetch directly
 * with `fetch` rather than the browser SDK because Server Components
 * run in Node and shouldn't drag Privy state into a public read.
 *
 * Revalidation: `revalidate: 60` gives merchants a 1-minute window
 * between publishing a change and it appearing on the storefront ,
 * long enough that a burst of shoppers hits the cache, short enough
 * that edits feel responsive.
 */

export interface StorefrontDetail {
  storefront: Storefront
  products: StorefrontProduct[]
}

export async function fetchPublicStorefront(slug: string): Promise<StorefrontDetail | null> {
  const url = `${env.apiUrl.replace(/\/$/, '')}/store/${encodeURIComponent(slug)}`
  const res = await fetch(url, { next: { revalidate: 60, tags: [`storefront:${slug}`] } })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`storefront fetch failed: ${res.status}`)
  }
  return (await res.json()) as StorefrontDetail
}
