'use client'

import Link from 'next/link'
import { Webhook } from 'lucide-react'
import { Badge, Button } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { ResourceList } from '@/components/dashboard/resource-list'

export default function WebhooksPage() {
  return (
    <>
      <PageHeader
        title="Webhook endpoints"
        description="HTTPS receivers for every event Strimz fires. Signed with HMAC-SHA256 (`t=…,v1=…` header)."
        action={<Button>Add endpoint</Button>}
      />
      <ResourceList<{ id: string; url: string; status: string; events: string[] }>
        rows={[]}
        emptyIcon={Webhook}
        emptyTitle="No webhook endpoints yet"
        emptyDescription="Add an HTTPS URL and pick the events you want to receive. We'll generate a signing secret you can verify on every request."
        emptyAction={
          <Button variant="outline" asChild>
            <Link href="/docs/webhooks">How webhook signing works →</Link>
          </Button>
        }
        columns={[
          { key: 'url', header: 'URL', render: (r) => <code className="text-xs">{r.url}</code> },
          { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'events', header: 'Events', render: (r) => `${r.events.length} subscribed` },
        ]}
      />
    </>
  )
}
