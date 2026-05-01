'use client'

import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { Badge, Button } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { ResourceList } from '@/components/dashboard/resource-list'

export default function InvoicesPage() {
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Send a hosted, branded invoice to any email — paid in USDC."
        action={
          <Button asChild>
            <Link href="/app/invoices/new">New invoice</Link>
          </Button>
        }
      />
      <ResourceList<{ id: string; number: string; status: string; total: string; dueAt: string }>
        rows={[]}
        emptyIcon={Receipt}
        emptyTitle="No invoices yet"
        emptyDescription="Create an invoice with line items and we'll generate a hosted checkout page automatically."
        columns={[
          { key: 'number', header: 'Invoice', render: (r) => r.number },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'total', header: 'Total', render: (r) => r.total, align: 'right' },
          { key: 'due', header: 'Due', render: (r) => r.dueAt },
        ]}
      />
    </>
  )
}
