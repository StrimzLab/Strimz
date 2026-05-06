'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/shared/logo'
import { ScrollProgressBar } from '@/components/shared/scroll-progress-bar'
import { MobileNav } from '@/components/shared/mobile-nav'
import { InteractiveHoverButton } from '@/components/effects/interactive-hover-button'

type NavLink = { href: string; label: string; external?: boolean }

const NAV_LINKS: NavLink[] = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/customers', label: 'Customers' },
  { href: '/docs', label: 'Docs', external: true },
  { href: '/contact', label: 'Contact' },
]

export function MarketingNav() {
  return (
    <>
      <ScrollProgressBar />
      <header className="flex h-[80px] w-full items-center bg-white px-4 md:h-[82px] md:px-8 lg:px-16">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <Logo />

          <div className="hidden items-center gap-[28px] lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noreferrer' : undefined}
                className="cursor-pointer font-poppins text-[15px] font-[400] capitalize text-[#58556A] transition-all hover:text-[#050020]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <InteractiveHoverButton
              type="button"
              icon={<ArrowRight className="h-4 w-4" />}
              innerClassName="bg-[#02C76A] rounded-[8px]"
              className="shadow-nav-cta flex h-[40px] cursor-pointer items-center justify-center whitespace-nowrap rounded-[8px] bg-[#F9FAFB] px-5 font-poppins text-[14px] font-[500] text-[#050020] transition-all duration-300 hover:text-white"
              onClick={() => (window.location.href = '/signup')}
            >
              Get started
            </InteractiveHoverButton>

            <div className="flex items-center lg:hidden">
              <MobileNav links={NAV_LINKS} />
            </div>
          </div>
        </nav>
      </header>
    </>
  )
}
