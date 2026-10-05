'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import {
  ArrowLeft,
  ArrowUpFromLine,
  BarChart3,
  Bot,
  Boxes,
  CreditCard,
  Globe2,
  Home,
  KeyRound,
  Receipt,
  RefreshCcw,
  Settings,
  Store,
  Users,
  Webhook,
} from 'lucide-react'
import { Logo } from '@/components/shared/logo'
import { cn } from '@strimz/ui'
import { useMerchantMe } from '@/hooks/api/use-merchant'

const SECTIONS: ReadonlyArray<{
  label: string
  links: ReadonlyArray<{
    href: string
    label: string
    icon: React.ComponentType<{ className?: string }>
  }>
}> = [
  {
    label: 'Overview',
    links: [
      { href: '/app', label: 'Home', icon: Home },
      { href: '/app/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Payments',
    links: [
      { href: '/app/payment-sessions', label: 'Sessions', icon: CreditCard },
      { href: '/app/subscriptions', label: 'Subscriptions', icon: Receipt },
      { href: '/app/invoices', label: 'Invoices', icon: Receipt },
      { href: '/app/refunds', label: 'Refunds', icon: RefreshCcw },
      { href: '/app/withdraw', label: 'Withdraw', icon: ArrowUpFromLine },
    ],
  },
  {
    label: 'Buyers',
    links: [
      { href: '/app/customers', label: 'Customers', icon: Users },
      { href: '/app/storefront', label: 'Storefront', icon: Store },
    ],
  },
  {
    label: 'Automation',
    links: [
      { href: '/app/agents', label: 'AutoPay Agent', icon: Bot },
      { href: '/app/webhooks', label: 'Webhooks', icon: Webhook },
    ],
  },
  {
    label: 'Configuration',
    links: [
      { href: '/app/api-keys', label: 'API keys', icon: KeyRound },
      { href: '/app/settings', label: 'Settings', icon: Settings },
    ],
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Dashboard sidebar. Full-height (`100dvh`), three-row flex column:
 *
 * Mobile slides in from the left with a backdrop. On `lg+` it's
 * sticky-positioned to the viewport.
 */
export function DashboardSidebar({ open, onClose }: Props) {
  const pathname = usePathname()

  // Lock body scroll when the mobile sidebar is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      {/* Backdrop (mobile only) */}
      {open ? (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'bg-muted fixed left-0 top-0 z-40 flex h-[100dvh] w-64 shrink-0 flex-col transition-transform duration-300 ease-out',
          'lg:border-border lg:sticky lg:translate-x-0 lg:border-r',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Sticky logo block. Close button shows on mobile only */}
        <div className="border-border bg-muted flex h-16 shrink-0 items-center justify-between border-b px-5">
          <Logo />
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-md border transition-colors lg:hidden"
          >
            <ArrowLeft className="size-4" />
          </button>
        </div>

        {/* Scrollable nav (no visible scrollbar) */}
        <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-3 pt-5">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="font-poppins text-muted-foreground/80 mb-1.5 px-3 text-[10px] font-[600] uppercase tracking-[0.18em]">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.links.map((link) => {
                  const active = pathname === link.href
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      data-tour={tourKeyFor(link.href)}
                      className={cn(
                        'font-poppins flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all',
                        active
                          ? 'shadow-sidebar-link border-border bg-card text-foreground border font-[500]'
                          : 'text-muted-foreground hover:text-foreground border border-transparent hover:bg-white/60',
                      )}
                    >
                      <link.icon className={cn('size-4', active && 'text-accent')} />
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sticky bottom block */}
        <div className="border-border shrink-0 space-y-1 border-t p-3">
          <OnboardingCard />
          <Link
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="font-poppins text-muted-foreground hover:bg-card hover:text-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
          >
            <Boxes className="size-4" />
            Documentation
          </Link>
          <a
            href="https://github.com/StrimzLab/strimz"
            target="_blank"
            rel="noreferrer"
            className="font-poppins text-muted-foreground hover:bg-card hover:text-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors"
          >
            <Globe2 className="size-4" />
            GitHub
          </a>
        </div>
      </aside>
    </>
  )
}

const TOUR_KEYS: Record<string, string> = {
  '/app/api-keys': 'nav-api-keys',
  '/app/payment-sessions': 'nav-payment-sessions',
  '/app/webhooks': 'nav-webhooks',
  '/app/settings': 'nav-settings',
}

function tourKeyFor(href: string): string | undefined {
  return TOUR_KEYS[href]
}

function OnboardingCard() {
  const { data: merchant } = useMerchantMe()
  if (!merchant || merchant.onboardingCompleted) return null
  return (
    <div className="strimz-alert-gradient shadow-accent/15 mb-2 rounded-xl p-4 text-white shadow-lg">
      <p className="font-poppins text-sm font-[500]">Unlock live mode ⚡</p>
      <p className="font-poppins mt-1 text-xs text-white/80">
        Finish onboarding and turn on 2FA to issue live keys.
      </p>
      <Link
        href="/onboarding"
        className="font-poppins text-foreground mt-3 inline-flex h-8 w-full items-center justify-center rounded-md bg-white/95 text-xs font-[500] transition-transform hover:scale-[1.02]"
      >
        Continue
      </Link>
    </div>
  )
}
