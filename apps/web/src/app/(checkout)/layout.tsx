import type { Metadata } from 'next'
import { Logo } from '@/components/shared/logo'

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white lg:h-screen lg:min-h-[100vh]">
      <header className="z-10 flex h-16 w-full shrink-0 items-center px-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Logo />
        </div>
      </header>

      <main className="z-10 flex w-full flex-1 items-start justify-center px-4 pb-12 pt-4 sm:px-6 lg:items-center lg:py-0">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
