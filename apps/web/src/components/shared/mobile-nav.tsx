'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LayoutDashboard, MoveUpRight } from 'lucide-react'
import { Sheet, SheetContent, SheetClose, SheetTrigger, SheetTitle, ThemeToggle } from '@strimz/ui'
import { Logo } from './logo'

type MobileLink = { href: string; label: string; external?: boolean }

/**
 * Mobile bottom-sheet navigation. Mirrors the strimz-subscription
 * `MobileNav` (Radix Sheet, large stacked links, auto-close on tap).
 *
 * `SheetTitle` is rendered visually-hidden. Radix Dialog (which Sheet
 * extends) requires a labelled title for screen readers.
 */
export function MobileNav({ links }: { links: MobileLink[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className="text-foreground hover:bg-muted flex size-10 items-center justify-center rounded-md transition-colors"
        >
          <LayoutDashboard className="size-6" />
        </button>
      </SheetTrigger>
      <SheetContent className="bg-muted w-full border-none p-0 outline-none">
        <SheetTitle className="sr-only">Site navigation</SheetTitle>
        <main className="flex w-full flex-col">
          <div className="flex w-full items-center justify-between px-6 py-6">
            <Logo />
            <ThemeToggle />
          </div>
          <nav className="mt-12 flex w-full flex-col items-center justify-center gap-6">
            {links.map((l) => (
              <SheetClose asChild key={l.href}>
                <Link
                  href={l.href}
                  target={l.external ? '_blank' : undefined}
                  rel={l.external ? 'noreferrer' : undefined}
                  className="font-poppins text-foreground flex items-center gap-2 text-2xl font-[500] capitalize transition-colors hover:underline"
                >
                  {l.label}
                  <MoveUpRight className="size-6" />
                </Link>
              </SheetClose>
            ))}
          </nav>
        </main>
      </SheetContent>
    </Sheet>
  )
}
