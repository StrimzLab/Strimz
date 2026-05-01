'use client'

import { KeyRound } from 'lucide-react'
import { Badge, Button } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { ResourceList } from '@/components/dashboard/resource-list'

export default function ApiKeysPage() {
  return (
    <>
      <PageHeader
        title="API keys"
        description="Test mode keys are free. Live mode unlocks once you complete onboarding + 2FA."
        action={<Button>Issue key</Button>}
      />
      <ResourceList<{ id: string; name: string; mode: string; prefix: string; lastUsedAt: string }>
        rows={[]}
        emptyIcon={KeyRound}
        emptyTitle="No keys yet"
        emptyDescription="Issue your first test-mode key. The full secret is shown exactly once — copy it somewhere safe."
        columns={[
          { key: 'name', header: 'Name', render: (r) => r.name },
          { key: 'mode', header: 'Mode', render: (r) => <Badge variant="secondary">{r.mode}</Badge> },
          { key: 'prefix', header: 'Key', render: (r) => <code className="text-xs">{r.prefix}…</code> },
          { key: 'last', header: 'Last used', render: (r) => r.lastUsedAt },
        ]}
      />
    </>
  )
}
