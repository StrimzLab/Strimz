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
      <Link href={`/store/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to {slug}
      </Link>
      <Card className="mt-6 border-border/60">
        <CardContent className="p-8">
          <h1 className="text-3xl font-bold tracking-tight">Product {productId}</h1>
          <p className="mt-2 text-sm text-muted-foreground">— USDC</p>
          <Button className="mt-6 w-full" size="lg">
            Buy now
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
