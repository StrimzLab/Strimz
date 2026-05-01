'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LogIn, Menu, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Logo } from '@/components/shared/logo'
import { ScrollProgressBar } from '@/components/shared/scroll-progress-bar'
import { InteractiveHoverButton } from '@/components/effects/interactive-hover-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@strimz/ui'

const NAV_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/customers', label: 'Customers' },
  { href: '/docs', label: 'Docs' },
  { href: '/about', label: 'About' },
] as const

export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <ScrollProgressBar />
      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'sticky top-0 z-40 w-full transition-all',
          scrolled
            ? 'border-b border-border/60 bg-background/85 backdrop-blur-xl strimz-card-shadow'
            : 'border-b border-transparent bg-background/60 backdrop-blur-md',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <InteractiveHoverButton
              type="button"
              icon={<LogIn className="h-4 w-4" />}
              innerClassName="bg-[#02C76A] rounded-md"
              className="strimz-nav-cta-shadow flex h-10 w-[120px] items-center justify-center rounded-md bg-muted/40 font-poppins text-sm font-medium text-foreground transition-all duration-300 hover:text-white"
              onClick={() => (window.location.href = '/login')}
            >
              Log in
            </InteractiveHoverButton>
            <Link
              href="/signup"
              className="strimz-cta-shadow inline-flex h-10 items-center justify-center rounded-md bg-[#02C76A] px-4 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
            >
              Get started
            </Link>
          </div>

          <button
            className="rounded-md p-2 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/60 bg-background md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 flex items-center gap-2">
                <ThemeToggle />
                <Link
                  href="/login"
                  className="flex-1 rounded-md border border-border px-3 py-2 text-center text-sm"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 rounded-md bg-[#02C76A] px-3 py-2 text-center text-sm font-medium text-white"
                >
                  Get started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </motion.header>
    </>
  )
}
