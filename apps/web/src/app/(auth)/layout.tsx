import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ThemeToggle } from '@strimz/ui'
import { Logo } from '@/components/shared/logo'
import { AuthBenefitsRow, AuthPanel } from '@/components/auth/auth-panel'
import authPattern from '@/../public/patterns/authPattern.png'
import authPattern2 from '@/../public/patterns/authPattern2.png'

/**
 * Group-wide metadata for `/signup`, `/login`, `/callback`. Per-page
 * titles + descriptions live in each page's sibling `layout.tsx` (the
 * page files themselves are `'use client'` and can't export metadata).
 */
export const metadata: Metadata = {
  // Auth surfaces shouldn't appear in search results or get link-previewed.
  robots: { index: false, follow: false },
}

/** Navy side panel beside the form from md up. On phones the form comes first; sign-up shows a benefits row. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-8">
      <aside className="bg-ink text-ink-foreground sticky top-0 hidden h-screen flex-col overflow-hidden p-10 md:col-span-3 md:flex lg:p-12">
        <Image
          src={authPattern}
          alt=""
          aria-hidden
          fill
          priority
          quality={100}
          className="pointer-events-none absolute inset-0 -bottom-12 -left-12 object-cover opacity-[0.18] mix-blend-screen"
        />
        <Image
          src={authPattern2}
          alt=""
          aria-hidden
          fill
          priority
          quality={100}
          className="pointer-events-none absolute -bottom-16 -right-12 object-cover opacity-[0.12] mix-blend-screen"
        />

        <AuthPanel />
      </aside>

      <section className="bg-muted relative flex flex-col md:col-span-5">
        <header className="flex items-center justify-between px-4 py-5 sm:px-8 md:px-10">
          <Logo className="md:hidden" />
          <span className="hidden md:block" />
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-poppins text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Back to site
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <AuthBenefitsRow />

        <div className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-8">{children}</div>
      </section>
    </div>
  )
}
