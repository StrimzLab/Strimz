import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { InactivityLogout } from '@/components/auth/inactivity-logout'

/**
 * Group-wide metadata for the merchant dashboard at `/app/*`. The title
 * template overrides the root's `'%s · Strimz'` so dashboard tabs read
 * `'Subscriptions · Strimz Dashboard'` etc. Auth-walled routes are
 * never indexed.
 */
export const metadata: Metadata = {
  title: {
    default: 'Strimz Dashboard',
    template: '%s · Strimz Dashboard',
  },
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InactivityLogout />
      <DashboardShell>{children}</DashboardShell>
    </>
  )
}
