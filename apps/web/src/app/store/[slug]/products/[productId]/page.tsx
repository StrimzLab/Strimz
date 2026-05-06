import Link from 'next/link'
import { Button, Card, CardContent } from '@strimz/ui'

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
          <p className="mt-2 font-mono text-sm text-[#58556A]">— USDC</p>
          <Button className="mt-6 w-full" size="lg">
            Buy now
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
