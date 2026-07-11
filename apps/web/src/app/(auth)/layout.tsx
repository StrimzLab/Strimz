import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Logo } from '@/components/shared/logo'
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

/**
 * Two-column auth shell. Direct match to strimz-subscription's auth
 * layout. Dark navy left panel with the white logo + tagline + decorative
 * pattern overlays; light right panel hosts the form.
 *
 * On mobile the left panel is hidden; the right panel takes the full
 * viewport (with a small in-page logo so users still see brand).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-8">
      {/* Left. Dark panel (hidden on mobile) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#050020] p-10 text-white md:col-span-3 md:flex lg:p-12">
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

        <div className="relative z-10">
          <Logo variant="white" className="w-[101px]" />
        </div>

        <div className="relative z-10 max-w-sm space-y-5">
          <h2 className="font-sora text-[28px] font-[700] leading-[36px] text-white lg:text-[34px] lg:leading-[42px]">
            Stablecoin billing infrastructure for the next billion businesses.
          </h2>
          <p className="font-poppins text-[14px] leading-[24px] text-[#D1D5DB]">
            One API. Settled in USDC on Arc. Gas-free for your customers, instant payouts for you.
          </p>
        </div>

        <div className="font-poppins relative z-10 flex items-center gap-2 text-[12px] text-[#D1D5DB]">
          <span className="size-1.5 rounded-full bg-[#02C76A]" />
          Live on Arc
        </div>
      </aside>

      {/* Right. Form panel */}
      <section className="relative flex flex-col bg-[#F9FAFB] md:col-span-5">
        <header className="flex items-center justify-between px-4 py-5 sm:px-8 md:px-10">
          <Logo className="md:hidden" />
          <span className="hidden md:block" />
          <Link
            href="/"
            className="font-poppins text-sm text-[#58556A] transition-colors hover:text-[#050020]"
          >
            Back to site
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-8">{children}</div>
      </section>
    </div>
  )
}
