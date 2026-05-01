'use client'

import { RefreshCcw } from 'lucide-react'
import { Badge, Button } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { ResourceList } from '@/components/dashboard/resource-list'

export default function RefundsPage() {
  return (
    <>
      <PageHeader
        title="Refunds"
        description="Server-side intent + wallet-signed transfer. Indexer reconciles on-chain status."
        action={<Button>New refund</Button>}
      />
      <ResourceList<{ id: string; transactionId: string; status: string; amount: string }>
        rows={[]}
        emptyIcon={RefreshCcw}
        emptyTitle="No refunds yet"
        emptyDescription="Pick a confirmed transaction to start. We'll generate the wallet-signing instructions."
        columns={[
          { key: 'id', header: 'ID', render: (r) => <code className="text-xs">{r.id}</code> },
          { key: 'tx', header: 'Original tx', render: (r) => <code className="text-xs">{r.transactionId}</code> },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'amount', header: 'Amount', render: (r) => r.amount, align: 'right' },
        ]}
      />
    </>
  )
}
