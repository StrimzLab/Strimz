import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge, Card, CardContent } from '@strimz/ui'
import { Logo } from '@/components/shared/logo'
import { OG_IMAGE } from '@/lib/seo'

/**
 * Per-storefront metadata. The slug is the merchant's chosen handle —
 * exposing it in the title is fine (storefronts are public surfaces).
 * Once the API is wired up, swap in the real merchant name + bio so
 * the OG card shows the storefront's branding.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const display = slug.charAt(0).toUpperCase() + slug.slice(1)
  return {
    title: display,
    description: `Buy from ${display} with USDC on Arc — instant, gas-free, no card needed.`,
    openGraph: {
      title: `${display} · Strimz Storefront`,
      description: `Pay ${display} in USDC on Arc.`,
      url: `/store/${slug}`,
      images: [OG_IMAGE],
    },
    alternates: { canonical: `/store/${slug}` },
  }
}

/**
 * Public hosted storefront. SSR'd, no auth — customers land directly
 * via a slug link.
 */
export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#E5E7EB]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href={`/store/${slug}`}
            className="font-sora text-base font-[700] capitalize text-[#050020]"
          >
            {slug}
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

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Badge variant="outline" className="mb-4">
          Storefront
        </Badge>
        <h1 className="font-sora text-[36px] font-[700] tracking-[-0.02em] text-[#050020] sm:text-[44px]">
          Welcome to <span className="capitalize text-[#02C76A]">{slug}</span>
        </h1>
        <p className="font-poppins mt-3 max-w-2xl text-base text-[#58556A]">
          Pay with USDC. Settles in seconds on Arc, no gas for you to worry about.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-sub-card col-span-full border-dashed border-[#E5E7EB] bg-[#F9FAFB]">
            <CardContent className="font-poppins p-12 text-center text-sm text-[#58556A]">
              This storefront hasn&apos;t published any products yet.
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
