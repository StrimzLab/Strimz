'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, Clock, Plus, X } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@strimz/ui'
import type { AgentJob } from '@strimz/shared-types'

import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { CreateAgentJobDialog } from '@/components/dashboard/agents/create-job-dialog'
import { relativeTime, shortAddress } from '@/lib/format'

const JOB_STATUS_TONE: Record<string, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  proposed: 'warning',
  accepted: 'info',
  in_progress: 'info',
  delivered: 'info',
  approved: 'info',
  completed: 'positive',
  disputed: 'danger',
  cancelled: 'neutral',
}

export function JobsTab({
  data,
  isLoading,
  isError,
  error,
  onRetry,
  onApprove,
  isApproving,
}: {
  data: AgentJob[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  onRetry: () => void
  onApprove: (job: AgentJob) => void
  isApproving: boolean
}) {
  const [openCreate, setOpenCreate] = React.useState(false)

  const columns = React.useMemo<ColumnDef<AgentJob>[]>(
    () => [
      {
        accessorKey: 'description',
        header: 'Job',
        cell: ({ row }) => (
          <Link
            href={`/app/agents/jobs/${row.original.id}`}
            className="flex flex-col leading-tight hover:underline"
          >
            <span className="text-sm font-medium">
              {row.original.description ?? row.original.id}
            </span>
            <code className="text-muted-foreground text-[11px]">
              {row.original.id.slice(0, 14)}…
            </code>
          </Link>
        ),
      },
      {
        accessorKey: 'vendorAddress',
        header: 'Vendor',
        cell: ({ row }) => (
          <code className="text-xs">{shortAddress(row.original.vendorAddress)}</code>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={JOB_STATUS_TONE[row.original.status] ?? 'neutral'}>
            {row.original.status.replace(/_/g, ' ')}
          </StatusPill>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {relativeTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const job = row.original
          if (job.status === 'proposed' || job.status === 'delivered') {
            return (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.preventDefault()
                  onApprove(job)
                }}
                disabled={isApproving}
              >
                <Check className="mr-1 size-3" /> Approve
              </Button>
            )
          }
          if (job.status === 'completed') return <Check className="text-accent size-4" />
          if (job.status === 'disputed') return <X className="size-4 text-rose-600" />
          if (job.status === 'cancelled') return <X className="text-muted-foreground size-4" />
          return <Clock className="text-muted-foreground size-4" />
        },
      },
    ],
    [isApproving, onApprove],
  )

  if (isError) {
    return <ErrorBanner message={error?.message ?? 'Failed to load jobs'} onRetry={onRetry} />
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-end">
        <Button size="sm" onClick={() => setOpenCreate(true)}>
          <Plus className="mr-1 size-4" />
          New job
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        searchPlaceholder="Search jobs…"
        emptyTitle="No agent jobs yet"
        emptyDescription="Create a job or wait for the Commerce agent to propose one."
      />
      <CreateAgentJobDialog open={openCreate} onOpenChange={setOpenCreate} />
    </>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
      <div>
        <div className="text-sm font-medium">Couldn’t load</div>
        <div className="text-muted-foreground text-xs">{message}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
