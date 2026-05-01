'use client'

import { CreditCard } from 'lucide-react'
import { Badge } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { ResourceList } from '@/components/dashboard/resource-list'

export default function PaymentSessionsPage() {
  return (
    <>
      <PageHeader
        title="Payment sessions"
        description="One-shot checkout sessions. Each gets a hosted page; webhooks fire on settlement."
      />
      <ResourceList<{ id: string; status: string; amount: string; description: string }>
        rows={[]}
        emptyIcon={CreditCard}
        emptyTitle="No sessions yet"
        emptyDescription="Create a session via the API or @strimz/sdk and link your customer to its checkoutUrl."
        columns={[
          { key: 'id', header: 'ID', render: (r) => <code className="text-xs">{r.id}</code> },
          { key: 'desc', header: 'Description', render: (r) => r.description ?? '—' },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'amount', header: 'Amount', render: (r) => r.amount, align: 'right' },
        ]}
      />
    </>
  )
}
