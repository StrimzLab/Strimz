'use client'

import * as React from 'react'
import { Bot, Mail, Activity, Wallet, ShoppingBag, BarChart3, Globe2, Check, X, Clock } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button, Badge, Card, CardContent, Switch,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { AGENT_CONFIG, AGENT_ACTIVITY, AGENT_JOBS, type AgentJob, type AgentCapability } from '@/data/agents'
import { formatUsdc, relativeTime, shortAddress } from '@/data/_seed'

const CAPABILITIES: { key: AgentCapability; name: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { key: 'recovery', icon: Mail, name: 'Recovery', desc: 'Email customers on at-risk subscriptions per your strategy.' },
  { key: 'cashflow', icon: Activity, name: 'Cashflow digest', desc: 'Daily summary of yesterday\'s gross, fees, net, customers.' },
  { key: 'cashflow_anomaly', icon: Activity, name: 'Cashflow anomaly', desc: 'Hourly z-score against your trailing 30-day baseline.' },
  { key: 'cashflow_yield', icon: Wallet, name: 'Yield recommendations', desc: 'Surplus-over-reserve detection. You sign every move.' },
  { key: 'commerce', icon: ShoppingBag, name: 'Commerce', desc: 'Vendor allowlist, monthly cap, awaiting-approval gating.' },
  { key: 'pricing_intelligence', icon: BarChart3, name: 'Pricing intelligence', desc: 'Monthly MRR, churn, and 90-day forecast email.' },
  { key: 'routing', icon: Globe2, name: 'CCTP V2 routing', desc: 'Cross-chain settlement so customers can pay from any USDC chain.' },
]

const OUTCOME_TONE: Record<string, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  success: 'positive',
  skipped: 'neutral',
  failed: 'danger',
}

export default function AgentsPage() {
  const [enabled, setEnabled] = React.useState<Set<AgentCapability>>(new Set(AGENT_CONFIG.enabledCapabilities))
  const successRate24h = AGENT_ACTIVITY.filter((a) => a.outcome === 'success').length / AGENT_ACTIVITY.length

  const activityCols: ColumnDef<typeof AGENT_ACTIVITY[number]>[] = React.useMemo(() => [
    {
      accessorKey: 'capability',
      header: 'Capability',
      cell: ({ row }) => <Badge variant="outline" className="text-[10px]">{row.original.capability.replace('_', ' ')}</Badge>,
    },
    {
      accessorKey: 'summary',
      header: 'Action',
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{row.original.summary}</span>
          <code className="text-[11px] text-muted-foreground">{row.original.actionType}</code>
        </div>
      ),
    },
    {
      accessorKey: 'outcome',
      header: 'Outcome',
      cell: ({ row }) => <StatusPill tone={OUTCOME_TONE[row.original.outcome] ?? 'neutral'}>{row.original.outcome}</StatusPill>,
    },
    {
      accessorKey: 'ref',
      header: 'Ref',
      cell: ({ row }) => row.original.ref ? <code className="text-xs text-muted-foreground">{row.original.ref.slice(0, 12)}…</code> : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'When',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{relativeTime(row.original.createdAt)}</span>,
    },
  ], [])

  const jobsCols: ColumnDef<AgentJob>[] = React.useMemo(() => [
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{row.original.vendor}</span>
          <code className="text-[11px] text-muted-foreground">{shortAddress(row.original.vendorWallet)}</code>
        </div>
      ),
    },
    { accessorKey: 'description', header: 'Description' },
    {
      accessorKey: 'amountUsdc',
      header: 'Amount',
      cell: ({ row }) => <span className="font-mono">{formatUsdc(row.original.amountUsdc)} USDC</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => row.original.status === 'proposed'
        ? <StatusPill tone="warning">awaiting approval</StatusPill>
        : <StatusPill tone="info">{row.original.status.replace('_', ' ')}</StatusPill>,
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.requiresApproval && row.original.status === 'proposed' ? (
          <div className="flex gap-1">
            <Button size="sm" className="h-8" onClick={() => toast.success(`Approved job ${row.original.id.slice(0, 10)}`)}>
              <Check className="mr-1 size-3.5" /> Approve
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => toast.success('Rejected')}>
              <X className="mr-1 size-3.5" /> Reject
            </Button>
          </div>
        ) : null,
    },
  ], [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="AutoPay Agent"
        description="An automated assistant that runs the tasks you turn on. It holds no keys and never moves funds without your approval."
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-[#02C76A]" />
              Healthy
            </Badge>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active capabilities" value={`${enabled.size} of ${CAPABILITIES.length}`} />
        <Stat label="Actions (14d)" value={AGENT_ACTIVITY.length.toLocaleString()} />
        <Stat label="Success rate" value={`${Math.round(successRate24h * 100)}%`} />
        <Stat label="Awaiting approval" value={AGENT_JOBS.filter((j) => j.status === 'proposed').length.toString()} />
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Bot className="size-4 text-[#02C76A]" />
          <h2 className="font-sora text-base font-semibold">Capabilities</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon
            return (
              <Card key={c.key} className="shadow-sub-card border-border/60">
                <CardContent className="flex items-start justify-between gap-4 p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="shadow-sub-icon flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#02C76A]/10 text-[#02C76A]">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium">{c.name}</div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled.has(c.key)}
                    onCheckedChange={(v) => {
                      const next = new Set(enabled)
                      if (v) next.add(c.key); else next.delete(c.key)
                      setEnabled(next)
                      toast.success(`${c.name} ${v ? 'enabled' : 'disabled'}`)
                    }}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity"><Activity className="mr-1.5 size-4" /> Activity log</TabsTrigger>
          <TabsTrigger value="jobs"><ShoppingBag className="mr-1.5 size-4" /> Commerce jobs ({AGENT_JOBS.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="activity" className="mt-4">
          <DataTable
            columns={activityCols}
            data={AGENT_ACTIVITY}
            searchPlaceholder="Search agent activity…"
            emptyTitle="No agent activity"
            emptyDescription="Agent capabilities will log here as they fire."
          />
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <DataTable
            columns={jobsCols}
            data={AGENT_JOBS}
            searchPlaceholder="Search jobs…"
            emptyTitle="No commerce jobs"
            emptyDescription="The commerce capability will create jobs here when it fires."
          />
        </TabsContent>
      </Tabs>

      <section className="shadow-sub-card rounded-xl border border-border/60 bg-background p-5">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="font-sora text-base font-semibold">Cron schedule</h3>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <ScheduleRow label="Recovery sweep" cron="hourly" />
          <ScheduleRow label="Cashflow digest" cron="daily 09:00 UTC" />
          <ScheduleRow label="Cashflow anomaly" cron="hourly" />
          <ScheduleRow label="Yield recommendation" cron="daily 09:30 UTC" />
          <ScheduleRow label="Commerce summary" cron="monthly 1st 09:00 UTC" />
          <ScheduleRow label="Pricing intelligence" cron="monthly 1st 09:00 UTC" />
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="shadow-sub-card rounded-xl border border-border/60 bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-sora text-2xl font-semibold">{value}</div>
    </div>
  )
}

function ScheduleRow({ label, cron }: { label: string; cron: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
      <span>{label}</span>
      <code className="text-xs text-muted-foreground">{cron}</code>
    </div>
  )
}
