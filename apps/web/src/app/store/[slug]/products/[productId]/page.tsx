import type { Metadata } from 'next'
import Link from 'next/link'
import { Button, Card, CardContent } from '@strimz/ui'
import { TokenLogo } from '@/components/shared/token-logo'

/**
 * Per-product metadata. Once the API is wired up, replace the synthetic
 * `Product {productId}` title with the real product name pulled by id.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}): Promise<Metadata> {
  const { slug, productId } = await params
  const display = slug.charAt(0).toUpperCase() + slug.slice(1)
  return {
    title: `Product ${productId} · ${display}`,
    description: `Buy product ${productId} from ${display} with USDC on Arc.`,
    alternates: { canonical: `/store/${slug}/products/${productId}` },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>
}) {
  const { slug, productId } = await params
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href={`/store/${slug}`}
        className="font-poppins text-sm text-[#58556A] transition-colors hover:text-[#050020]"
      >
        ← Back to {slug}
      </Link>
      <Card className="shadow-sub-card mt-6 border-[#E5E7EB]">
        <CardContent className="p-8">
          <h1 className="font-sora text-3xl font-[700] tracking-tight text-[#050020]">
            Product {productId}
          </h1>
          <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-sm text-[#58556A]">
            <TokenLogo symbol="USDC" size={14} />— priced in USDC
          </p>
          <Button className="mt-6 w-full" size="lg">
            Buy now
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
