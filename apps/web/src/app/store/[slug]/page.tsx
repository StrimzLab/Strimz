import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, CardContent } from '@strimz/ui'
import { TokenLogo } from '@/components/shared/token-logo'
import { OG_IMAGE } from '@/lib/seo'
import { fetchPublicStorefront } from '@/lib/public-store'
import { formatTokenAmount } from '@/lib/format'

/**
 * Per-storefront metadata. Pulls the merchant's own name + description
 * from the storefront row so the OG card shows real branding.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const detail = await fetchPublicStorefront(slug).catch(() => null)
  const name = detail?.storefront.name ?? slug
  const description =
    detail?.storefront.description ??
    `Buy from ${name} with USDC on Arc. Instant, gas-free, no card needed.`
  return {
    title: name,
    description,
    openGraph: {
      title: `${name} · Strimz Storefront`,
      description,
      url: `/store/${slug}`,
      images: [OG_IMAGE],
    },
    alternates: { canonical: `/store/${slug}` },
  }
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const detail = await fetchPublicStorefront(slug)
  if (!detail) notFound()
  const { storefront, products } = detail
  const accent = storefront.accentColor ?? '#02C76A'
  return (
    <>
      {storefront.coverImageUrl && (
        <div className="bg-ink relative h-[240px] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={storefront.coverImageUrl}
            alt=""
            className="h-full w-full object-cover opacity-70"
          />
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Badge variant="outline" className="mb-4">
          Storefront
        </Badge>
        <h1 className="font-sora text-foreground text-[36px] font-[700] tracking-[-0.02em] sm:text-[44px]">
          {storefront.name}
        </h1>
        {storefront.description && (
          <p className="font-poppins text-muted-foreground mt-3 max-w-2xl text-base">
            {storefront.description}
          </p>
        )}
        {storefront.socialLinks.length > 0 && (
          <ul className="text-muted-foreground mt-4 flex flex-wrap gap-3 text-sm">
            {storefront.socialLinks.map((link) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer" className="hover:text-foreground">
                  {new URL(link).host}
                </a>
              </li>
            ))}
          </ul>
        )}

        {products.length === 0 ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-sub-card border-border bg-muted col-span-full border-dashed">
              <CardContent className="font-poppins text-muted-foreground p-12 text-center text-sm">
                This storefront hasn&apos;t published any products yet.
              </CardContent>
            </Card>
          </div>
        ) : (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id}>
                <Link href={`/store/${slug}/products/${product.id}`} className="group block">
                  <Card className="shadow-sub-card border-border group-hover:border-accent/60 overflow-hidden transition-all group-hover:shadow-md">
                    <div className="bg-muted relative aspect-video w-full overflow-hidden">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white"
                          style={{ background: accent }}
                        >
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {product.type === 'subscription' && (
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary absolute right-2 top-2">
                          Subscription
                        </Badge>
                      )}
                      {product.stock !== null && product.stock <= 0 && (
                        <div className="text-muted-foreground absolute inset-0 grid place-items-center bg-white/80 font-semibold">
                          Sold out
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-sora text-foreground text-base font-[600]">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="font-poppins text-muted-foreground mt-1 line-clamp-2 text-sm">
                          {product.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-1.5">
                        <TokenLogo symbol={product.currency} size={14} />
                        <span className="font-sora text-foreground text-lg font-[600]">
                          {formatTokenAmount(product.price, product.currency)}
                        </span>
                        <span className="font-poppins text-muted-foreground text-xs">
                          {product.currency}
                          {product.type === 'subscription' && product.interval
                            ? ` / ${product.interval}`
                            : ''}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
