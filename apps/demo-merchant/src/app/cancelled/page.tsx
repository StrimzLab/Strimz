import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'

export default function CancelledPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          No worries. Nothing was charged.
        </h1>
        <p className="muted mx-auto mt-4 max-w-xl text-lg leading-8">
          You closed the checkout before signing. Come back any time.
        </p>
        <Link
          href="/"
          className="hover:border-brand-500 mt-10 inline-flex items-center rounded-full border border-[hsl(var(--border))] px-6 py-3 text-sm font-semibold text-[hsl(var(--fg))]"
        >
          Take me back
        </Link>
      </main>
      <Footer />
    </>
  )
}
