import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AdminShell } from '@/components/admin/admin-shell'

/**
 * Group-wide metadata for `/admin/*`. Same noindex stance as the
 * merchant dashboard since the operator surface should never be in
 * search results.
 */
export const metadata: Metadata = {
  title: {
    default: 'Strimz Admin',
    template: '%s · Strimz Admin',
  },
  robots: { index: false, follow: false },
}

export default function AdminLayoutRoot({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
