'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import {
  ArrowLeft,
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
 * Dashboard sidebar — full-height (`100dvh`), three-row flex column:
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
          'fixed left-0 top-0 z-40 flex h-[100dvh] w-64 shrink-0 flex-col bg-[#F9FAFB] transition-transform duration-300 ease-out',
          'lg:sticky lg:translate-x-0 lg:border-r lg:border-[#E5E7EB]',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Sticky logo block — close button shows on mobile only */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-5">
          <Logo />
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#58556A] transition-colors hover:bg-[#F9FAFB] hover:text-[#050020] lg:hidden"
          >
            <ArrowLeft className="size-4" />
          </button>
        </div>

        {/* Scrollable nav (no visible scrollbar) */}
        <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto p-3 pt-5">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="font-poppins mb-1.5 px-3 text-[10px] font-[600] uppercase tracking-[0.18em] text-[#58556A]/80">
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
                      className={cn(
                        'font-poppins flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all',
                        active
                          ? 'shadow-sidebar-link border border-[#E5E7EB] bg-white font-[500] text-[#050020]'
                          : 'border border-transparent text-[#58556A] hover:bg-white/60 hover:text-[#050020]',
                      )}
                    >
                      <link.icon className={cn('size-4', active && 'text-[#02C76A]')} />
                      {link.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sticky bottom block */}
        <div className="shrink-0 space-y-1 border-t border-[#E5E7EB] p-3">
          <UpgradeBanner />
          <Link
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="font-poppins flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#58556A] transition-colors hover:bg-white hover:text-[#050020]"
          >
            <Boxes className="size-4" />
            Documentation
          </Link>
          <a
            href="https://github.com/StrimzLab/strimz"
            target="_blank"
            rel="noreferrer"
            className="font-poppins flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-[#58556A] transition-colors hover:bg-white hover:text-[#050020]"
          >
            <Globe2 className="size-4" />
            GitHub
          </a>
        </div>
      </aside>
    </>
  )
}

/**
 * Live-mode readiness banner. Renders only while there's still gating
 * work to do (onboarding form, or 2FA). The copy + CTA changes to match
 * whichever step is missing, so the user always sees the next action.
 * Once both flips are true, the banner disappears entirely — the
 * onboarding mutation's cache invalidation drives the re-render.
 */
function UpgradeBanner() {
  const { data: merchant } = useMerchantMe()

  // Loading the merchant — render nothing rather than flash a banner
  // that immediately disappears once data arrives.
  if (!merchant) return null

  const needsOnboarding = !merchant.onboardingCompleted
  const needs2FA = !merchant.twoFactorEnabled

  if (!needsOnboarding && !needs2FA) return null

  const title = needsOnboarding ? 'Unlock live mode ⚡' : 'Almost there ⚡'
  const body = needsOnboarding
    ? 'Finish onboarding and turn on 2FA to issue live keys.'
    : 'Turn on 2FA to issue live keys.'
  const ctaHref = needsOnboarding ? '/app/onboarding' : '/app/settings/security'
  const ctaLabel = needsOnboarding ? 'Continue' : 'Enable 2FA'

  return (
    <div className="strimz-alert-gradient mb-2 rounded-xl p-4 text-white shadow-lg shadow-[#02C76A]/15">
      <p className="font-poppins text-sm font-[500]">{title}</p>
      <p className="font-poppins mt-1 text-xs text-white/80">{body}</p>
      <Link
        href={ctaHref}
        className="font-poppins mt-3 inline-flex h-8 w-full items-center justify-center rounded-md bg-white/95 text-xs font-[500] text-[#050020] transition-transform hover:scale-[1.02]"
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
