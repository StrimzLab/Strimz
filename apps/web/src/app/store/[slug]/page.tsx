import Link from 'next/link'
import { Badge, Card, CardContent } from '@strimz/ui'
import { Logo } from '@/components/shared/logo'
import { ThemeToggle } from '@/components/theme-toggle'

/**
 * Public hosted storefront. SSR'd, no auth — customers land directly
 * via a slug link.
 */
export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href={`/store/${slug}`} className="font-poppins font-semibold capitalize">
            {slug}
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>Powered by</span>
              <Logo className="!gap-1.5 [&>span]:!text-sm" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <Badge variant="outline" className="mb-4">Storefront</Badge>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Welcome to <span className="capitalize">{slug}</span>
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pay with USDC. Settled instantly on Arc — no gas for you.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="col-span-full strimz-card-shadow border-dashed border-border/60 bg-muted/20">
            <CardContent className="p-12 text-center text-sm text-muted-foreground">
              This storefront has no published products yet.
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
