'use client'

import * as React from 'react'
import { Mail, Activity, ShoppingBag, BarChart3, Globe2, Settings2, Shield } from 'lucide-react'
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
import type { AgentActivityLog, AgentCapability, AgentMerchantConfig } from '@strimz/shared-types'
import { AGENT_CAPABILITIES } from '@strimz/shared-config'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import {
  CashflowSettingsDialog,
  RecoverySettingsDialog,
} from '@/components/dashboard/agents/settings-dialogs'
import { relativeTime } from '@/lib/format'
import { useAgentActivity, useAgentConfig, useUpdateAgentConfig } from '@/hooks/api'

type CapabilityMeta = {
  key: AgentCapability
  name: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
  configurable: 'recovery' | 'cashflow' | null
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
    configurable: null,
    ...(AGENT_CAPABILITIES.commerce.available
      ? {}
      : { gate: 'coming_soon' as const, gateHint: 'Not available at launch.' }),
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

export default function AgentsPage() {
  const configQuery = useAgentConfig()
  const activityQuery = useAgentActivity({ limit: 50 })
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
        description="Opt-in AI agents that act on your behalf. Recovery emails, cashflow alerts and pricing insights. You sign every value-moving action."
      />

      <Tabs defaultValue="capabilities">
        <TabsList>
          <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
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
  const [openDialog, setOpenDialog] = React.useState<'recovery' | 'cashflow' | null>(null)

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
          <a className="text-accent" href="mailto:support@strimz.finance">
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
                  <div className="bg-accent/10 text-accent flex h-9 w-9 items-center justify-center rounded-md">
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
                          className="border-accent/40 bg-accent/10 text-accent text-[10px]"
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
                      className="border-accent/40 bg-accent/10 text-accent text-[10px]"
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
