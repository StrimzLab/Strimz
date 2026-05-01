'use client'

import { Users } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { ResourceList } from '@/components/dashboard/resource-list'

export default function CustomersPage() {
  return (
    <>
      <PageHeader
        title="Customers"
        description="Every wallet that's paid you. Indexed automatically — no row to create manually."
      />
      <ResourceList<{ id: string; email: string; walletAddress: string; lastSeenAt: string }>
        rows={[]}
        emptyIcon={Users}
        emptyTitle="No customers yet"
        emptyDescription="Customers appear here automatically the first time a wallet pays one of your sessions or subscriptions."
        columns={[
          { key: 'email', header: 'Email', render: (r) => r.email ?? '—' },
          { key: 'wallet', header: 'Wallet', render: (r) => <code className="text-xs">{r.walletAddress}</code> },
          { key: 'last', header: 'Last seen', render: (r) => r.lastSeenAt },
        ]}
      />
    </>
  )
}
