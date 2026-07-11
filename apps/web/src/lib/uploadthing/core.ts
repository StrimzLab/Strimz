import 'server-only'

import { createUploadthing } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'
import type { FileRouter } from 'uploadthing/next'
import { env } from '@/lib/env'

const f = createUploadthing()

/**
 * Validate the caller's Privy session against apps/api. Reused across
 * every merchant-owned upload route. Two upsides to proxying through
 * `/v1/merchants/me` instead of decoding the token here:
 *
 *   1. Zero cryptographic surface in apps/web. The NestJS Privy guard
 *      already carries JWKS + audience checks. We inherit them.
 *   2. `merchantId` is returned by the same call, so the file router
 *      doesn't need to re-derive it from the Privy user id.
 *
 * We ignore cookies deliberately. The merchant dashboard sends the
 * Privy access token via `Authorization: Bearer <token>` on every
 * request. The UploadThing client attaches the same header via its
 * `headers` option (see `apps/web/src/components/dashboard/image-upload.tsx`).
 */
async function requireMerchant(req: Request): Promise<{ merchantId: string }> {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    throw new UploadThingError('Missing bearer token')
  }
  const res = await fetch(`${env.apiUrl}/v1/merchants/me`, {
    method: 'GET',
    headers: { authorization: auth, accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new UploadThingError(res.status === 401 ? 'Session expired' : 'Not authorized')
  }
  const merchant = (await res.json()) as { id?: string }
  if (!merchant.id) {
    throw new UploadThingError('Merchant not resolved')
  }
  return { merchantId: merchant.id }
}

/**
 * Strimz upload endpoints. Three slugs, all single-image with size
 * caps tuned to the surface each one drives:
 *
 *   - `storefrontLogo`  ,  2MB, header-position brand mark
 *   - `storefrontCover` ,  4MB, wide hero banner
 *   - `productImage`    ,  4MB, per-product tile art
 *
 * Middleware verifies the merchant; the `onUploadComplete` callback
 * returns the CDN URL to the client so the calling form can save it
 * via the merchant API (`upsertStorefront` / `addStorefrontProduct`).
 * We deliberately DON'T save the URL server-side here. The storefront
 * upsert is what persists it; if the merchant abandons the form the
 * upload just sits orphaned in UploadThing (cheap on their free tier).
 */
export const strimzFileRouter = {
  merchantLogo: f({
    image: { maxFileSize: '2MB', maxFileCount: 1 },
  })
    .middleware(({ req }) => requireMerchant(req))
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, merchantId: metadata.merchantId, slug: 'merchant-logo' }
    }),

  storefrontLogo: f({
    image: { maxFileSize: '2MB', maxFileCount: 1 },
  })
    .middleware(({ req }) => requireMerchant(req))
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, merchantId: metadata.merchantId, slug: 'logo' }
    }),

  storefrontCover: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .middleware(({ req }) => requireMerchant(req))
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, merchantId: metadata.merchantId, slug: 'cover' }
    }),

  productImage: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .middleware(({ req }) => requireMerchant(req))
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, merchantId: metadata.merchantId, slug: 'product' }
    }),
} satisfies FileRouter

export type StrimzFileRouter = typeof strimzFileRouter
