'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import {
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
      {open && (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-40 flex h-[100svh] w-64 shrink-0 flex-col justify-between bg-muted/30 transition-transform duration-300 ease-out lg:sticky lg:translate-x-0 lg:border-r lg:border-border/40 lg:bg-muted/20',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col">
          <div className="flex h-16 items-center border-b border-border/40 px-5">
            <Logo />
          </div>

          <nav className="space-y-6 overflow-y-auto p-3 pt-5">
            {SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.links.map((link) => {
                    const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onClose}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all',
                          active
                            ? 'border border-border/60 bg-background font-medium text-foreground strimz-sidebar-link-shadow'
                            : 'border border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground',
                        )}
                      >
                        <link.icon
                          className={cn('size-4', active && 'text-[#02C76A]')}
                        />
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        <div className="space-y-1 border-t border-border/40 p-3">
          <UpgradeCard />
          <Link
            href="/docs"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Boxes className="size-4" />
            Documentation
          </Link>
          <a
            href="https://github.com/StrimzLab/strimz"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Globe2 className="size-4" />
            GitHub
          </a>
        </div>
      </aside>
    </>
  )
}

function UpgradeCard() {
  return (
    <div className="mb-2 rounded-xl bg-gradient-to-br from-[#02C76A] via-[#10b981] to-emerald-500 p-4 text-white shadow-lg shadow-[#02C76A]/20">
      <p className="font-poppins text-sm font-medium">Unlock live mode ⚡</p>
      <p className="mt-1 text-xs text-white/80">Complete onboarding + 2FA to issue live keys.</p>
      <Link
        href="/app/onboarding"
        className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md bg-white/95 text-xs font-medium text-[#050020] transition-transform hover:scale-[1.02]"
      >
        Continue
      </Link>
    </div>
  )
}
