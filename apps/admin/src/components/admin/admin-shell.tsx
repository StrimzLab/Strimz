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
  ScrollText,
  Server,
  ShieldCheck,
  Users2,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Button, ThemeToggle } from '@strimz/ui'

import { useAdminMe } from '@/hooks/admin'
import type { AdminRole } from '@strimz/web-shared/lib/admin-api'
import { adminGate, safeNextPath, withNext } from '@strimz/web-shared/lib/auth-redirect'
import { BlockieAvatar } from '@strimz/web-shared/components/dashboard/blockie-avatar'

const NAV: {
  href: string
  label: string
  icon: typeof Activity
  roles?: readonly AdminRole[]
}[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/merchants', label: 'Merchants', icon: Users2 },
  { href: '/admin/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { href: '/admin/analytics', label: 'Analytics', icon: Activity },
  { href: '/admin/health', label: 'Health', icon: Server },
  { href: '/admin/admins', label: 'Admins', icon: ShieldCheck },
  // Rows include admins' IP addresses.
  {
    href: '/admin/audit-log',
    label: 'Audit log',
    icon: ScrollText,
    roles: ['super_admin', 'admin'],
  },
] as const

// Admin access is an active AdminUser row and nothing else. Signing in
// here never creates a merchant; that only happens on the merchant login.
export function AdminShell({ children }: { children: ReactNode }) {
  const { ready, authenticated, logout } = usePrivy()
  const router = useRouter()
  const pathname = usePathname()

  const meQuery = useAdminMe({ enabled: ready && authenticated })
  const gate = adminGate({
    privyReady: ready,
    authenticated,
    me: { isPending: meQuery.isPending, error: meQuery.error, data: meQuery.data },
  })

  useEffect(() => {
    if (gate.kind === 'login') router.replace(withNext('/admin/login', safeNextPath(pathname)))
  }, [gate.kind, pathname, router])

  async function handleSignOut() {
    try {
      await logout()
    } finally {
      router.replace('/admin/login')
    }
  }

  if (gate.kind === 'login') return null

  if (gate.kind === 'loading') {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Checking admin access…</div>
      </div>
    )
  }

  if (gate.kind === 'denied' || gate.kind === 'error') {
    return (
      <div className="bg-background relative flex min-h-screen items-center justify-center p-6">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="border-border/60 bg-card mx-auto max-w-md space-y-4 rounded-xl border p-6 text-center">
          <h1 className="font-sora text-xl font-semibold">
            {gate.kind === 'denied' ? 'Not authorized' : 'Could not check admin access'}
          </h1>
          <p className="text-muted-foreground text-sm" role="alert">
            {gate.kind === 'denied'
              ? 'This account isn’t a Strimz admin. Sign in with an admin account, or ask a super admin for an invite.'
              : gate.message}
          </p>
          <div className="flex justify-center gap-2">
            {gate.kind === 'error' ? (
              <Button variant="outline" onClick={() => void meQuery.refetch()}>
                Try again
              </Button>
            ) : null}
            <Button onClick={handleSignOut}>Sign out</Button>
          </div>
        </div>
      </div>
    )
  }

  const { admin } = gate

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border/60 hidden w-60 border-r p-4 lg:flex lg:flex-col">
        <Link href="/admin" className="mb-6 flex items-center gap-2">
          <span className="bg-accent inline-block h-2 w-2 rounded-full" />
          <span className="font-display font-semibold">Strimz Admin</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.filter((item) => !item.roles || item.roles.includes(admin.role)).map((item) => {
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
                    ? 'bg-accent/10 text-accent font-medium'
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border/60 flex h-14 shrink-0 items-center justify-end border-b px-6 sm:px-8">
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">{children}</main>
      </div>
    </div>
  )
}
