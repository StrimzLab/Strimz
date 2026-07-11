'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Mail,
  Activity,
  ShoppingBag,
  BarChart3,
  Globe2,
  Check,
  X,
  Clock,
  Plus,
  Settings2,
  Shield,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@strimz/ui'
import type {
  AgentActivityLog,
  AgentCapability,
  AgentJob,
  AgentMerchantConfig,
} from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import {
  CashflowSettingsDialog,
  CommerceSettingsDialog,
  RecoverySettingsDialog,
} from '@/components/dashboard/agents/settings-dialogs'
import { CreateAgentJobDialog } from '@/components/dashboard/agents/create-job-dialog'
import { relativeTime, shortAddress } from '@/lib/format'
import {
  useAgentActivity,
  useAgentConfig,
  useAgentJobs,
  useApproveAgentJob,
  useUpdateAgentConfig,
} from '@/hooks/api'

type CapabilityMeta = {
  key: AgentCapability
  name: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
  configurable: 'recovery' | 'cashflow' | 'commerce' | null
  gate?: 'managed' | 'coming_soon'
  gateHint?: string
}

const CAPABILITIES: CapabilityMeta[] = [
  {
    key: 'identity',
    icon: Shield,
    name: 'Identity',
    desc: 'On-chain agent identity registration. Required for every other capability.',
    configurable: null,
    gate: 'managed',
    gateHint: 'Provisioned by Strimz when your merchant onboards.',
  },
  {
    key: 'recovery',
    icon: Mail,
    name: 'Recovery',
    desc: 'Email customers on at-risk subscriptions per your strategy.',
    configurable: 'recovery',
  },
  {
    key: 'cashflow',
    icon: Activity,
    name: 'Cashflow digest',
    desc: "Daily summary of yesterday's gross, fees, net, customers. Anomaly alerts and optional yield recommendations.",
    configurable: 'cashflow',
  },
  {
    key: 'commerce',
    icon: ShoppingBag,
    name: 'Commerce',
    desc: 'Agent-driven escrow jobs with vendor allowlist and approval thresholds.',
    configurable: 'commerce',
  },
  {
    key: 'pricing_intelligence',
    icon: BarChart3,
    name: 'Pricing intelligence',
    desc: 'Monthly MRR, churn, and 90-day forecast email.',
    configurable: null,
  },
  {
    key: 'routing',
    icon: Globe2,
    name: 'CCTP routing',
    desc: 'Cross-chain USDC settlement so customers can pay from any chain.',
    configurable: null,
    gate: 'coming_soon',
    gateHint: 'Coming with the Whisk cross-chain integration.',
  },
]

const OUTCOME_TONE: Record<string, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  success: 'positive',
  pending: 'info',
  skipped: 'neutral',
  failure: 'danger',
}

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

export default function AgentsPage() {
  const configQuery = useAgentConfig()
  const activityQuery = useAgentActivity({ limit: 50 })
  const jobsQuery = useAgentJobs({ limit: 50 })
  const approveMutation = useApproveAgentJob()
  const updateConfigMutation = useUpdateAgentConfig()

  const config = configQuery.data
  const enabledSet = React.useMemo(
    () => new Set<AgentCapability>(config?.enabledCapabilities ?? []),
    [config?.enabledCapabilities],
  )

  const toggleCapability = (cap: AgentCapability, on: boolean) => {
    if (!config) return
    const next = new Set(config.enabledCapabilities)
    if (on) next.add(cap)
    else next.delete(cap)
    updateConfigMutation.mutate({ enabledCapabilities: Array.from(next) })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        docsSlug="agents"
        description="Opt-in AI agents that act on your behalf. Recovery emails, cashflow alerts, escrow flows. You sign every value-moving action."
      />

      <Tabs defaultValue="capabilities">
        <TabsList>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="capabilities" className="mt-4">
          <CapabilitiesTab
            config={config}
            isLoading={configQuery.isLoading}
            enabledSet={enabledSet}
            onToggle={toggleCapability}
            isUpdating={updateConfigMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityTab
            data={activityQuery.data?.data ?? []}
            isLoading={activityQuery.isLoading}
            isError={activityQuery.isError}
            error={activityQuery.error}
            onRetry={activityQuery.refetch}
          />
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <JobsTab
            data={jobsQuery.data?.data ?? []}
            isLoading={jobsQuery.isLoading}
            isError={jobsQuery.isError}
            error={jobsQuery.error}
            onRetry={jobsQuery.refetch}
            onApprove={(id) => approveMutation.mutate(id)}
            isApproving={approveMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CapabilitiesTab({
  config,
  isLoading,
  enabledSet,
  onToggle,
  isUpdating,
}: {
  config: AgentMerchantConfig | undefined
  isLoading: boolean
  enabledSet: Set<AgentCapability>
  onToggle: (cap: AgentCapability, on: boolean) => void
  isUpdating: boolean
}) {
  const [openDialog, setOpenDialog] = React.useState<'recovery' | 'cashflow' | 'commerce' | null>(
    null,
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-border/60 bg-muted/30 h-24 animate-pulse rounded-xl border"
          />
        ))}
      </div>
    )
  }

  if (!config) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 text-center text-sm">
          Agents aren't enabled for this account yet. Contact{' '}
          <a className="text-[#02C76A]" href="mailto:support@strimz.finance">
            support
          </a>{' '}
          to provision the agent identity for your merchant.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon
          const isEnabled = enabledSet.has(cap.key)
          const isManaged = cap.gate === 'managed'
          const isComingSoon = cap.gate === 'coming_soon'
          return (
            <Card key={cap.key} className="border-border/60">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="flex flex-1 items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#02C76A]/10 text-[#02C76A]">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">{cap.name}</h3>
                      {isManaged ? (
                        <Badge
                          variant="outline"
                          className="border-border/60 text-muted-foreground text-[10px]"
                        >
                          Managed
                        </Badge>
                      ) : null}
                      {isComingSoon ? (
                        <Badge
                          variant="outline"
                          className="border-border/60 text-muted-foreground text-[10px]"
                        >
                          Coming soon
                        </Badge>
                      ) : null}
                      {isEnabled && !isManaged && !isComingSoon ? (
                        <Badge
                          variant="outline"
                          className="border-[#02C76A]/40 bg-[#02C76A]/10 text-[10px] text-[#02C76A]"
                        >
                          Enabled
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{cap.desc}</p>
                    {cap.gateHint ? (
                      <p className="text-muted-foreground mt-1 text-[11px] italic">
                        {cap.gateHint}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cap.configurable && isEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setOpenDialog(cap.configurable)}
                      disabled={isUpdating}
                    >
                      <Settings2 className="mr-1 size-3" />
                      Configure
                    </Button>
                  ) : null}

                  {isManaged ? (
                    <Badge
                      variant="outline"
                      className="border-[#02C76A]/40 bg-[#02C76A]/10 text-[10px] text-[#02C76A]"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(v) => onToggle(cap.key, v)}
                      disabled={isUpdating || isComingSoon}
                      aria-label={`Toggle ${cap.name}`}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <RecoverySettingsDialog
        open={openDialog === 'recovery'}
        onOpenChange={(o) => setOpenDialog(o ? 'recovery' : null)}
        config={config}
      />
      <CashflowSettingsDialog
        open={openDialog === 'cashflow'}
        onOpenChange={(o) => setOpenDialog(o ? 'cashflow' : null)}
        config={config}
      />
      <CommerceSettingsDialog
        open={openDialog === 'commerce'}
        onOpenChange={(o) => setOpenDialog(o ? 'commerce' : null)}
        config={config}
      />
    </>
  )
}

function ActivityTab({
  data,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  data: AgentActivityLog[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  onRetry: () => void
}) {
  const columns = React.useMemo<ColumnDef<AgentActivityLog>[]>(
    () => [
      {
        accessorKey: 'actionType',
        header: 'Action',
        cell: ({ row }) => <code className="text-xs font-medium">{row.original.actionType}</code>,
      },
      {
        accessorKey: 'capability',
        header: 'Capability',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs capitalize">
            {row.original.capability.replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        accessorKey: 'outcome',
        header: 'Outcome',
        cell: ({ row }) => (
          <StatusPill tone={OUTCOME_TONE[row.original.outcome] ?? 'neutral'}>
            {row.original.outcome}
          </StatusPill>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'When',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {relativeTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  )

  if (isError) {
    return <ErrorBanner message={error?.message ?? 'Failed to load activity'} onRetry={onRetry} />
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      searchPlaceholder="Search activity…"
      emptyTitle="No agent activity yet"
      emptyDescription="When you enable a capability and it runs, you'll see the log here."
    />
  )
}

function JobsTab({
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
  onApprove: (id: string) => void
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
                  onApprove(job.id)
                }}
                disabled={isApproving}
              >
                <Check className="mr-1 size-3" /> Approve
              </Button>
            )
          }
          if (job.status === 'completed') return <Check className="size-4 text-[#02C76A]" />
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
