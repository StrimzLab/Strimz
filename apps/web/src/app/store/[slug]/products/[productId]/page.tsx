import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, CardContent } from '@strimz/ui'
import { TokenLogo } from '@/components/shared/token-logo'
import { BuyButton } from '@/components/store/buy-button'
import { fetchPublicStorefront } from '@/lib/public-store'
import { formatTokenAmount } from '@/lib/format'

async function loadProduct(slug: string, productId: string) {
  const detail = await fetchPublicStorefront(slug)
  if (!detail) return null
  const product = detail.products.find((p) => p.id === productId)
  if (!product) return null
  return { storefront: detail.storefront, product }
}

/** Per-product metadata. Real title + description sourced from the row. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}): Promise<Metadata> {
  const { slug, productId } = await params
  const found = await loadProduct(slug, productId).catch(() => null)
  const title = found ? `${found.product.name} · ${found.storefront.name}` : 'Product'
  const description =
    found?.product.description ??
    (found
      ? `Buy ${found.product.name} from ${found.storefront.name} with USDC on Arc.`
      : 'A Strimz-hosted product.')
  return {
    title,
    description,
    alternates: { canonical: `/store/${slug}/products/${productId}` },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}) {
  const { slug, productId } = await params
  const found = await loadProduct(slug, productId)
  if (!found) notFound()
  const { storefront, product } = found

  const priceLabel = formatTokenAmount(product.price, product.currency)
  const soldOut = product.stock !== null && product.stock <= 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href={`/store/${slug}`}
        className="font-poppins text-sm text-[#58556A] transition-colors hover:text-[#050020]"
      >
        ← Back to {storefront.name}
      </Link>

      <Card className="shadow-sub-card mt-6 overflow-hidden border-[#E5E7EB]">
        {product.imageUrl && (
          <div className="relative aspect-video w-full overflow-hidden bg-[#F9FAFB]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            {product.type === 'subscription' && (
              <Badge className="absolute right-3 top-3 bg-[#050020] text-white hover:bg-[#050020]">
                Subscription
              </Badge>
            )}
          </div>
        )}
        <CardContent className="p-8">
          <h1 className="font-sora text-3xl font-[700] tracking-tight text-[#050020]">
            {product.name}
          </h1>
          <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-sm text-[#58556A]">
            <TokenLogo symbol={product.currency} size={14} />
            {priceLabel} {product.currency}
            {product.type === 'subscription' && product.interval ? ` / ${product.interval}` : ''}
          </p>
          {product.description && (
            <p className="font-poppins mt-6 whitespace-pre-line text-sm leading-6 text-[#58556A]">
              {product.description}
            </p>
          )}
          {product.stock !== null && product.stock > 0 && (
            <p className="font-poppins mt-4 text-xs text-[#58556A]">
              Only {product.stock} left in stock.
            </p>
          )}

          <div className="mt-8">
            {soldOut ? (
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-center text-sm text-[#58556A]">
                This product is sold out.
              </div>
            ) : (
              <BuyButton
                slug={slug}
                productId={product.id}
                currency={product.currency}
                priceLabel={priceLabel}
                productType={product.type}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
