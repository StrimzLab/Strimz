import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ThemeToggle } from '@strimz/ui'
import { CheckoutProviders } from '@/components/checkout-providers'
import { HiddenInEmbed } from '@/components/checkout/hidden-in-embed'
import { Logo } from '@/components/shared/logo'
import { embedThemeScript } from '@/lib/theme'

/**
 * Group-wide metadata for `/pay/[sessionId]` and `/sub/[planId]`.
 * Checkout URLs are tokenized one-shot links and should never be
 * indexed or link-previewed.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: embedThemeScript() }} />
      <CheckoutProviders>
        <div className="bg-background relative flex min-h-screen flex-col overflow-hidden lg:h-screen lg:min-h-[100vh]">
          <header className="z-10 flex h-16 w-full shrink-0 items-center px-4 sm:px-6 lg:px-10">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
              <Logo />
              <Suspense fallback={null}>
                <HiddenInEmbed>
                  <ThemeToggle />
                </HiddenInEmbed>
              </Suspense>
            </div>
          </header>

          <main className="z-10 flex w-full flex-1 items-start justify-center px-4 pb-12 pt-4 sm:px-6 lg:items-center lg:py-0">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </CheckoutProviders>
    </>
  )
}
