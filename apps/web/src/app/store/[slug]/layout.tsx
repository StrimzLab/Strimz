import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ThemeToggle } from '@strimz/ui'
import { Logo } from '@/components/shared/logo'
import { fetchPublicStorefront } from '@/lib/public-store'

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const detail = await fetchPublicStorefront(slug)
  if (!detail) notFound()
  const { storefront } = detail
  const accent = storefront.accentColor ?? '#02C76A'

  return (
    <div className="bg-background min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href={`/store/${slug}`}
            className="font-sora text-foreground inline-flex items-center gap-2 text-base font-[700]"
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
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-poppins text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs transition-colors"
            >
              <span>Powered by</span>
              <Logo className="w-[64px]" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
