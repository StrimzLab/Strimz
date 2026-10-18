'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  ThemeToggle,
  cn,
} from '@strimz/ui'
import menuIcon from '@iconify-icons/solar/hamburger-menu-linear'
import { Logo } from '@/components/shared/logo'
import { MkIcon } from './icon'
import { PopLink } from './fx/pop-button'

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/customers', label: 'Customers' },
  { href: '/docs', label: 'Docs' },
  { href: '/contact', label: 'Contact' },
]

export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const linksRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Spotlight hover adapted from Vengeance UI's Spotlight Navbar (MIT).
  const onMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const el = linksRef.current
    if (!el) return
    el.style.setProperty('--spot-x', `${e.clientX - el.getBoundingClientRect().left}px`)
    el.style.setProperty('--spot-o', '1')
  }

  return (
    <header className="sticky top-0 z-50 px-2 pt-2 sm:px-3">
      <a
        href="#main"
        className="bg-foreground text-background sr-only rounded-full px-4 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10"
      >
        Skip to content
      </a>
      <nav
        aria-label="Main"
        className={cn(
          'mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-[20px] border px-4 transition-[height,background-color,border-color,box-shadow] duration-300 sm:px-5',
          scrolled
            ? 'bg-background/75 border-border h-14 shadow-[0_12px_40px_-18px_rgb(5_0_32/0.35)] backdrop-blur-xl backdrop-saturate-150'
            : 'h-[72px] border-transparent bg-transparent',
        )}
      >
        <Logo />
        <ul
          ref={linksRef}
          onPointerMove={onMove}
          onPointerLeave={() => linksRef.current?.style.setProperty('--spot-o', '0')}
          className="relative hidden items-center rounded-full p-1 [--spot-o:0] lg:flex"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full opacity-[var(--spot-o)] transition-opacity duration-300 [background:radial-gradient(90px_circle_at_var(--spot-x)_50%,rgb(2_199_106/0.16),transparent_70%)]"
          />
          {LINKS.map((l) => (
            <li key={l.href} className="relative">
              <Link
                href={l.href}
                className="font-poppins text-muted-foreground hover:text-foreground focus-visible:ring-accent rounded-full px-4 py-2 text-[15px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="font-poppins text-foreground focus-visible:ring-accent hidden rounded-full px-2 text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 sm:inline"
          >
            Sign in
          </Link>
          <ThemeToggle />
          <PopLink href="/signup" size="sm" className="hidden sm:inline-flex">
            Get started
          </PopLink>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="text-foreground hover:bg-muted focus-visible:ring-accent flex size-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 lg:hidden"
              >
                <MkIcon icon={menuIcon} className="size-6" />
              </button>
            </SheetTrigger>
            <SheetContent
              aria-describedby={undefined}
              className="bg-background w-full border-none p-6"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo />
              <ul className="mt-12 space-y-1">
                {[...LINKS, { href: '/login', label: 'Sign in' }].map((l) => (
                  <li key={l.href}>
                    <SheetClose asChild>
                      <Link
                        href={l.href}
                        className="font-sora text-foreground block py-2 text-3xl font-semibold tracking-[-0.03em]"
                      >
                        {l.label}
                      </Link>
                    </SheetClose>
                  </li>
                ))}
              </ul>
              <SheetClose asChild>
                <PopLink href="/signup" className="mt-10 flex w-full text-base">
                  Get started
                </PopLink>
              </SheetClose>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
