'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import {
  Activity,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Server,
  ShieldCheck,
  Users2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@strimz/ui'

import { useAdminMe } from '@/hooks/admin'
import { BlockieAvatar } from '@/components/dashboard/blockie-avatar'

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/merchants', label: 'Merchants', icon: Users2 },
  { href: '/admin/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { href: '/admin/analytics', label: 'Analytics', icon: Activity },
  { href: '/admin/health', label: 'Health', icon: Server },
  { href: '/admin/admins', label: 'Admins', icon: ShieldCheck },
] as const

/**
 * Admin app shell. Sidebar + top bar + auth gate.
 *
 * Auth state machine:
 *   - Privy session loading → render a soft skeleton.
 *   - Privy unauthenticated → redirect to /login.
 *   - Privy authenticated, AdminAuthGuard rejects (forbidden) → render
 *     a NotAuthorized card; offer to sign out.
 *   - Authorized → render the shell + children.
 *
 * We deliberately don't catch the "merchant exists but no AdminUser"
 * case as a redirect to the merchant dashboard. An operator might
 * also be a merchant, but the admin surface is intentionally
 * inaccessible without an AdminUser row.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout } = usePrivy()
  const router = useRouter()
  const pathname = usePathname()

  const meQuery = useAdminMe({ enabled: ready && authenticated })

  async function handleSignOut() {
    try {
      await logout()
    } finally {
      router.replace('/login')
    }
  }

  // Privy still hydrating.
  if (!ready) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="bg-muted/40 h-8 w-32 animate-pulse rounded" />
      </div>
    )
  }

  // No session → kick to login.
  if (!authenticated) {
    if (typeof window !== 'undefined') {
      router.replace('/login?next=' + encodeURIComponent(pathname))
    }
    return null
  }

  // Authorized fetch in flight.
  if (meQuery.isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Checking admin access…</div>
      </div>
    )
  }

  // Backend says you're not an admin.
  if (meQuery.isError || !meQuery.data) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-6">
        <div className="border-border/60 bg-card mx-auto max-w-md space-y-4 rounded-xl border p-6 text-center">
          <h1 className="font-sora text-xl font-semibold">Not authorized</h1>
          <p className="text-muted-foreground text-sm">
            Your account isn’t a Strimz admin. If this is unexpected, reach out to the team for
            access.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/app">Go to merchant dashboard</Link>
            </Button>
            <Button onClick={handleSignOut}>Sign out</Button>
          </div>
        </div>
      </div>
    )
  }

  const admin = meQuery.data

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border/60 hidden w-60 border-r p-4 lg:flex lg:flex-col">
        <Link href="/admin" className="mb-6 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[#02C76A]" />
          <span className="font-display font-semibold">Strimz Admin</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname?.startsWith(item.href + '/'))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-[#02C76A]/10 font-medium text-[#02C76A]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="size-4" />
                {item.label}
                {active ? <ChevronRight className="ml-auto size-4 opacity-50" /> : null}
              </Link>
            )
          })}
        </nav>
        <div className="border-border/60 mt-4 border-t pt-3">
          <div className="flex items-center gap-2">
            <div className="border-border/60 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border">
              <BlockieAvatar seed={admin.email} size={28} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-muted-foreground truncate text-xs">{admin.email}</div>
              <span className="border-border/60 mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[10px] capitalize">
                {admin.role.replace('_', ' ')}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 w-full justify-start px-2 text-xs"
            onClick={handleSignOut}
          >
            <LogOut className="mr-1.5 size-3" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 sm:p-8">{children}</main>
    </div>
  )
}
