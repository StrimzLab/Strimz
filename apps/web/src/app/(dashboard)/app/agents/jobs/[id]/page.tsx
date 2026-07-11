'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardContent } from '@strimz/ui'
import type { AgentJob, AgentJobStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { StatusPill } from '@/components/dashboard/data-table'
import { formatTokenAmount, relativeTime, shortAddress } from '@/lib/format'
import { env } from '@/lib/env'
import { useAgentJob, useApproveAgentJob } from '@/hooks/api'

const EXPLORER_BY_ENV = {
  testnet: 'https://testnet.arcscan.app/tx/',
  mainnet: 'https://arcscan.app/tx/',
} as const

const STATUS_TONE: Record<AgentJobStatus, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> =
  {
    proposed: 'warning',
    accepted: 'info',
    in_progress: 'info',
    delivered: 'info',
    approved: 'info',
    completed: 'positive',
    disputed: 'danger',
    cancelled: 'neutral',
  }

export default function AgentJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: job, isLoading, isError, error } = useAgentJob(id)
  const approve = useApproveAgentJob()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job" description="Loading job…" />
        <div className="border-border/60 bg-muted/30 h-40 animate-pulse rounded-xl border" />
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job" description="Couldn't load this job." />
        <Card className="border-border/60">
          <CardContent className="p-6 text-sm">
            {error?.message ?? 'Job not found or you don’t have access.'}
          </CardContent>
        </Card>
        <BackLink />
      </div>
    )
  }

  const canApprove = job.status === 'proposed' || job.status === 'delivered'
  const explorerBase = EXPLORER_BY_ENV[env.arcEnvironment]

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader title={job.description || 'Agent job'} description={job.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard job={job} />
        <TimelineCard job={job} explorerBase={explorerBase} />
      </div>

      {canApprove ? (
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-medium">Awaiting your approval</div>
              <p className="text-muted-foreground text-xs">
                Approval releases escrow to the vendor. This is the value-moving step, and it
                requires your signature.
              </p>
            </div>
            <Button
              onClick={() => approve.mutate(job.id)}
              disabled={approve.isPending}
              className="shrink-0"
            >
              <Check className="mr-1.5 size-4" />
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/app/agents"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
    >
      <ArrowLeft className="size-3" />
      Back to agents
    </Link>
  )
}

function SummaryCard({ job }: { job: AgentJob }) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-5 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Status</div>
          <div className="mt-1">
            <StatusPill tone={STATUS_TONE[job.status]}>{job.status.replace(/_/g, ' ')}</StatusPill>
          </div>
        </div>
        <Row label="Amount">
          <span className="font-medium">{formatTokenAmount(job.amount, job.currency)}</span>
        </Row>
        <Row label="Vendor">
          <AddressWithCopy value={job.vendorAddress} />
        </Row>
        <Row label="Assessor">
          <AddressWithCopy value={job.assessorAddress} />
        </Row>
        {job.onchainJobId != null ? (
          <Row label="On-chain job id">
            <Badge variant="outline">#{job.onchainJobId}</Badge>
          </Row>
        ) : null}
        <Row label="Description">
          <p className="text-foreground whitespace-pre-wrap text-sm">{job.description}</p>
        </Row>
      </CardContent>
    </Card>
  )
}

function TimelineCard({ job, explorerBase }: { job: AgentJob; explorerBase: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-5 text-sm">
        <div className="text-muted-foreground text-xs uppercase tracking-wide">Timeline</div>
        <Row label="Created">
          <span>{relativeTime(job.createdAt)}</span>
        </Row>
        {job.completedAt ? (
          <Row label="Completed">
            <span>{relativeTime(job.completedAt)}</span>
          </Row>
        ) : null}
        {job.deliverableHash ? (
          <Row label="Deliverable hash">
            <code className="text-xs">{shortAddress(job.deliverableHash)}</code>
          </Row>
        ) : null}
        {job.escrowTxHash ? (
          <Row label="Escrow tx">
            <ExplorerLink hash={job.escrowTxHash} base={explorerBase} />
          </Row>
        ) : null}
        {job.releaseTxHash ? (
          <Row label="Release tx">
            <ExplorerLink hash={job.releaseTxHash} base={explorerBase} />
          </Row>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function AddressWithCopy({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="text-xs">{shortAddress(value)}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value)
          toast.success('Address copied')
        }}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Copy address"
      >
        <Copy className="size-3" />
      </button>
    </div>
  )
}

function ExplorerLink({ hash, base }: { hash: string; base: string }) {
  return (
    <a
      href={`${base}${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-[#02C76A] hover:underline"
    >
      {shortAddress(hash)}
      <ExternalLink className="size-3" />
    </a>
  )
}
