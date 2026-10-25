'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  ThemeToggle,
  cn,
} from '@strimz/ui'
import menuIcon from '@iconify-icons/solar/hamburger-menu-linear'
import arrowIcon from '@iconify-icons/solar/arrow-right-linear'
import { Logo } from '@/components/shared/logo'
import { MkIcon } from './icon'
import { PopLink } from './fx/pop-button'
import { NAV_GROUPS, NAV_LINKS, type NavGroup, type NavItem } from './nav-data'
import { panelAnchor } from './nav-panel'

const TOP_ITEM =
  'font-poppins text-muted-foreground hover:text-foreground data-[state=open]:text-foreground aria-[current=page]:text-foreground focus-visible:ring-accent relative whitespace-nowrap rounded-full px-3 py-2 text-[15px] xl:px-4 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2'

const VIEWPORT_WIDTH = 'var(--radix-navigation-menu-viewport-width)'
const PANEL_LEFT = `clamp(var(--panel-min), calc(var(--panel-x) - ${VIEWPORT_WIDTH} / 2), calc(var(--panel-max) - ${VIEWPORT_WIDTH}))`
const PANEL_DEFAULTS = {
  '--panel-x': '50%',
  '--panel-min': '0px',
  '--panel-max': '100%',
} as React.CSSProperties

const STEPS = ['Create a link', 'Share it', 'Customer approves', 'Paid to your wallet']

function isCurrent(pathname: string, href: string) {
  const path = href.split('#')[0] || '/'
  return path !== '/' && (pathname === path || pathname.startsWith(`${path}/`))
}

export function MarketingNav() {
  const pathname = usePathname() ?? '/'
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const linksRef = useRef<HTMLUListElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const openMenu = useRef('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const placePanel = () => {
    const menu = menuRef.current
    const trigger = menu?.querySelector(`[data-menu="${openMenu.current}"]`)
    const bar = barRef.current
    const panel = panelRef.current
    if (!menu || !trigger || !bar || !panel) return
    const { x, min, max } = panelAnchor({
      root: menu.getBoundingClientRect(),
      bar: bar.getBoundingClientRect(),
      trigger: trigger.getBoundingClientRect(),
    })
    panel.style.setProperty('--panel-x', `${x}px`)
    panel.style.setProperty('--panel-min', `${min}px`)
    panel.style.setProperty('--panel-max', `${max}px`)
  }

  useEffect(() => {
    window.addEventListener('resize', placePanel)
    return () => window.removeEventListener('resize', placePanel)
  })

  const onMenuChange = (value: string) => {
    openMenu.current = value
    if (value) placePanel()
  }

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
      <div
        ref={barRef}
        className={cn(
          'mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-[20px] border px-4 transition-[height,background-color,border-color,box-shadow] duration-300 sm:px-5',
          scrolled
            ? 'bg-background/75 border-border h-14 shadow-[0_12px_40px_-18px_rgb(5_0_32/0.35)] backdrop-blur-xl backdrop-saturate-150'
            : 'h-[72px] border-transparent bg-transparent',
        )}
      >
        <Logo />
        <NavigationMenu
          ref={menuRef}
          aria-label="Main"
          className="hidden lg:flex"
          onValueChange={onMenuChange}
        >
          <NavigationMenuList
            ref={linksRef}
            onPointerMove={onMove}
            onPointerLeave={() => linksRef.current?.style.setProperty('--spot-o', '0')}
            className="relative gap-0 rounded-full p-1 [--spot-o:0]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full opacity-[var(--spot-o)] transition-opacity duration-300 [background:radial-gradient(90px_circle_at_var(--spot-x)_50%,rgb(2_199_106/0.16),transparent_70%)]"
            />
            {NAV_GROUPS.map((group, i) => (
              <GroupMenu key={group.label} group={group} pathname={pathname}>
                {i === 1
                  ? NAV_LINKS.map((link) => (
                      <TopLink key={link.href} link={link} pathname={pathname} />
                    ))
                  : null}
              </GroupMenu>
            ))}
          </NavigationMenuList>
          <div
            ref={panelRef}
            className="absolute left-0 top-full w-full pt-2"
            style={PANEL_DEFAULTS}
          >
            <NavigationMenuViewport
              className="border-border bg-background rounded-[22px] border shadow-[0_24px_60px_-24px_rgb(5_0_32/0.45)] transition-[width,height,left]"
              style={{ left: PANEL_LEFT }}
            />
          </div>
        </NavigationMenu>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="font-poppins text-foreground focus-visible:ring-accent hidden whitespace-nowrap rounded-full px-2 text-[15px] font-medium focus-visible:outline-none focus-visible:ring-2 sm:inline"
          >
            Sign in
          </Link>
          <ThemeToggle />
          <PopLink href="/signup" size="sm" className="hidden whitespace-nowrap sm:inline-flex">
            Start free
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
              className="bg-background w-full overflow-y-auto border-none p-6"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo />
              <nav aria-label="Main" className="mt-10">
                <Accordion type="single" collapsible>
                  {NAV_GROUPS.map((group) => (
                    <AccordionItem key={group.label} value={group.label} className="border-border">
                      <AccordionTrigger className="font-sora text-foreground py-3 text-3xl font-semibold tracking-[-0.03em] hover:no-underline">
                        {group.label}
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-1">
                          {group.items.map((item) => (
                            <li key={item.href}>
                              <SheetClose asChild>
                                <Link
                                  href={item.href}
                                  aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                                  className="font-poppins text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground block rounded-lg py-2 text-lg"
                                >
                                  {item.label}
                                </Link>
                              </SheetClose>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                <ul className="mt-2 space-y-1">
                  {[...NAV_LINKS, { href: '/login', label: 'Sign in' }].map((l) => (
                    <li key={l.href}>
                      <SheetClose asChild>
                        <Link
                          href={l.href}
                          aria-current={isCurrent(pathname, l.href) ? 'page' : undefined}
                          className="font-sora text-foreground block py-3 text-3xl font-semibold tracking-[-0.03em]"
                        >
                          {l.label}
                        </Link>
                      </SheetClose>
                    </li>
                  ))}
                </ul>
              </nav>
              <SheetClose asChild>
                <PopLink href="/signup" className="mt-10 flex w-full text-base">
                  Start free
                </PopLink>
              </SheetClose>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

function GroupMenu({
  group,
  pathname,
  children,
}: {
  group: NavGroup
  pathname: string
  children?: React.ReactNode
}) {
  const active = group.items.some((item) => isCurrent(pathname, item.href))
  return (
    <>
      <NavigationMenuItem value={group.label} className="relative">
        <NavigationMenuTrigger
          data-menu={group.label}
          className={TOP_ITEM}
          aria-current={active ? 'page' : undefined}
        >
          {group.label}
        </NavigationMenuTrigger>
        <NavigationMenuContent>
          <Panel group={group} pathname={pathname} />
        </NavigationMenuContent>
      </NavigationMenuItem>
      {children}
    </>
  )
}

function TopLink({ link, pathname }: { link: NavItem; pathname: string }) {
  const current = isCurrent(pathname, link.href)
  return (
    <NavigationMenuItem className="relative">
      <NavigationMenuLink asChild active={current}>
        <Link href={link.href} className={TOP_ITEM} aria-current={current ? 'page' : undefined}>
          {link.label}
        </Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  )
}

function Panel({ group, pathname }: { group: NavGroup; pathname: string }) {
  const wide = group.items.length > 4
  return (
    <div
      className={cn(
        'flex gap-2 p-2',
        group.feature ? 'w-[760px]' : wide ? 'w-[600px]' : 'w-[340px]',
      )}
    >
      <ul className={cn('grid flex-1 gap-0.5', wide && 'grid-cols-2')}>
        {group.items.map((item) => (
          <li key={item.href}>
            <PanelLink item={item} current={isCurrent(pathname, item.href)} />
          </li>
        ))}
      </ul>
      {group.feature ? <Feature item={group.feature} /> : null}
    </div>
  )
}

function PanelLink({ item, current }: { item: NavItem; current: boolean }) {
  return (
    <NavigationMenuLink asChild active={current}>
      <Link
        href={item.href}
        aria-current={current ? 'page' : undefined}
        className="hover:bg-muted focus-visible:bg-muted focus-visible:ring-accent group/item flex gap-3 rounded-[14px] p-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2"
      >
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-150',
            item.icon
              ? 'bg-accent/10 text-accent-ink dark:text-accent group-hover/item:bg-accent/20'
              : 'text-muted-foreground',
          )}
        >
          <MkIcon icon={item.icon ?? arrowIcon} className="size-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="font-poppins text-foreground block text-sm font-medium">
            {item.label}
          </span>
          <span className="font-poppins text-muted-foreground mt-0.5 block text-[13px] leading-snug">
            {item.description}
          </span>
        </span>
      </Link>
    </NavigationMenuLink>
  )
}

function Feature({ item }: { item: NavItem }) {
  return (
    <NavigationMenuLink asChild>
      <Link
        href={item.href}
        className="bg-ink grain focus-visible:ring-accent group/feature relative isolate flex w-[220px] shrink-0 flex-col justify-between overflow-hidden rounded-[16px] p-5 text-white focus-visible:outline-none focus-visible:ring-2 dark:ring-1 dark:ring-white/10"
      >
        <span
          aria-hidden
          className="absolute -right-16 -top-16 -z-10 size-48 rounded-full bg-[radial-gradient(closest-side,rgb(2_199_106/0.35),transparent)]"
        />
        <ol aria-hidden className="relative space-y-2.5 pl-5">
          <span className="bg-accent/40 absolute bottom-1.5 left-[5px] top-1.5 w-px" />
          {STEPS.map((step, i) => (
            <li key={step} className="font-poppins relative text-xs text-white/75">
              <span
                className={cn(
                  'absolute -left-5 top-1/2 size-[11px] -translate-y-1/2 rounded-full border-2',
                  i === STEPS.length - 1
                    ? 'border-accent bg-accent'
                    : 'border-accent bg-[rgb(5_0_32)]',
                )}
              />
              {step}
            </li>
          ))}
        </ol>
        <span className="mt-8">
          <span className="font-sora block text-lg font-semibold leading-tight tracking-[-0.02em]">
            {item.label}
          </span>
          <span className="font-poppins mt-2 block text-[13px] leading-snug text-white/70">
            {item.description}
          </span>
          <span className="font-poppins text-accent mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium">
            See how it works
            <MkIcon
              icon={arrowIcon}
              className="size-4 transition-transform duration-200 group-hover/feature:translate-x-0.5 motion-reduce:transition-none"
            />
          </span>
        </span>
      </Link>
    </NavigationMenuLink>
  )
}
