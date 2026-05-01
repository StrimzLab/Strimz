'use client'

import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { Badge, Button } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { ResourceList } from '@/components/dashboard/resource-list'

export default function SubscriptionsPage() {
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Recurring revenue, settled in USDC."
        action={
          <Button asChild>
            <Link href="/docs/sdks">Create via API</Link>
          </Button>
        }
      />
      <ResourceList<{ id: string; status: string; amount: string; nextChargeAt: string }>
        rows={[]}
        emptyIcon={Receipt}
        emptyTitle="No subscriptions yet"
        emptyDescription="Customers create subscriptions on-chain via your checkout flow. The indexer projects them here."
        emptyAction={
          <Button variant="outline" asChild>
            <Link href="/docs/api-reference#subscriptions">Read the API reference →</Link>
          </Button>
        }
        columns={[
          { key: 'id', header: 'ID', render: (r) => <code className="text-xs">{r.id}</code> },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'amount', header: 'Amount', render: (r) => r.amount, align: 'right' },
          { key: 'next', header: 'Next charge', render: (r) => r.nextChargeAt },
        ]}
      />
    </>
  )
}
