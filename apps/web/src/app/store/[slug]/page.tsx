import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge, Card, CardContent } from '@strimz/ui'
import { Logo } from '@/components/shared/logo'
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
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#E5E7EB]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href={`/store/${slug}`}
            className="font-sora inline-flex items-center gap-2 text-base font-[700] text-[#050020]"
          >
            {storefront.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={storefront.logoUrl}
                alt={`${storefront.name} logo`}
                className="size-6 rounded object-cover"
              />
            ) : (
              <span
                className="inline-flex size-6 items-center justify-center rounded text-xs font-semibold text-white"
                style={{ background: accent }}
              >
                {storefront.name.charAt(0).toUpperCase()}
              </span>
            )}
            {storefront.name}
          </Link>
          <Link
            href="/"
            className="font-poppins inline-flex items-center gap-2 text-xs text-[#58556A] transition-colors hover:text-[#050020]"
          >
            <span>Powered by</span>
            <Logo className="w-[64px]" />
          </Link>
        </div>
      </header>

      {storefront.coverImageUrl && (
        <div className="relative h-[240px] w-full overflow-hidden bg-[#050020]">
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
        <h1 className="font-sora text-[36px] font-[700] tracking-[-0.02em] text-[#050020] sm:text-[44px]">
          {storefront.name}
        </h1>
        {storefront.description && (
          <p className="font-poppins mt-3 max-w-2xl text-base text-[#58556A]">
            {storefront.description}
          </p>
        )}
        {storefront.socialLinks.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-3 text-sm text-[#58556A]">
            {storefront.socialLinks.map((link) => (
              <li key={link}>
                <a href={link} target="_blank" rel="noreferrer" className="hover:text-[#050020]">
                  {new URL(link).host}
                </a>
              </li>
            ))}
          </ul>
        )}

        {products.length === 0 ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-sub-card col-span-full border-dashed border-[#E5E7EB] bg-[#F9FAFB]">
              <CardContent className="font-poppins p-12 text-center text-sm text-[#58556A]">
                This storefront hasn&apos;t published any products yet.
              </CardContent>
            </Card>
          </div>
        ) : (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id}>
                <Link href={`/store/${slug}/products/${product.id}`} className="group block">
                  <Card className="shadow-sub-card overflow-hidden border-[#E5E7EB] transition-all group-hover:border-[#02C76A]/60 group-hover:shadow-md">
                    <div className="relative aspect-video w-full overflow-hidden bg-[#F9FAFB]">
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
                        <Badge className="absolute right-2 top-2 bg-[#050020] text-white hover:bg-[#050020]">
                          Subscription
                        </Badge>
                      )}
                      {product.stock !== null && product.stock <= 0 && (
                        <div className="absolute inset-0 grid place-items-center bg-white/80 font-semibold text-[#58556A]">
                          Sold out
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-sora text-base font-[600] text-[#050020]">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="font-poppins mt-1 line-clamp-2 text-sm text-[#58556A]">
                          {product.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-1.5">
                        <TokenLogo symbol={product.currency} size={14} />
                        <span className="font-sora text-lg font-[600] text-[#050020]">
                          {formatTokenAmount(product.price, product.currency)}
                        </span>
                        <span className="font-poppins text-xs text-[#58556A]">
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
    </div>
  )
}
