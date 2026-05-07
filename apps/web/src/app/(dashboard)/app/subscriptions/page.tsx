'use client'

import * as React from 'react'
import { Download, MoreHorizontal, Plus, Ban, Eye } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@strimz/ui'
import { toast } from 'sonner'
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { downloadCsv } from '@/lib/csv-export'
import {
  SUBSCRIPTIONS,
  type Subscription,
  type SubscriptionStatus,
  PLANS,
} from '@/data/subscriptions'
import { formatUsdc, relativeTime, shortAddress } from '@/data/_seed'

const STATUS_TONE: Record<
  SubscriptionStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  active: 'positive',
  trialing: 'info',
  at_risk: 'warning',
  paused: 'neutral',
  cancelled: 'neutral',
  lapsed: 'danger',
}

export default function SubscriptionsPage() {
  const [statusFilter, setStatusFilter] = React.useState<SubscriptionStatus | 'all'>('all')
  const filtered = React.useMemo(
    () =>
      statusFilter === 'all'
        ? SUBSCRIPTIONS
        : SUBSCRIPTIONS.filter((s) => s.status === statusFilter),
    [statusFilter],
  )

  const columns: ColumnDef<Subscription>[] = React.useMemo(
    () => [
      {
        accessorKey: 'customerEmail',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.customerEmail ?? 'Wallet only'}</span>
            <code className="text-muted-foreground text-[11px]">
              {shortAddress(row.original.customerWallet)}
            </code>
          </div>
        ),
      },
      {
        accessorKey: 'planName',
        header: 'Plan',
        cell: ({ row }) => <span className="font-medium">{row.original.planName}</span>,
      },
      {
        accessorKey: 'amountUsdc',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatUsdc(row.original.amountUsdc)} USDC
            <span className="text-muted-foreground text-xs">
              {' '}
              /{row.original.interval.replace('ly', '')}
            </span>
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={STATUS_TONE[row.original.status]}>
            {row.original.status.replace('_', ' ')}
          </StatusPill>
        ),
      },
      {
        accessorKey: 'totalChargedUsdc',
        header: 'Total charged',
        cell: ({ row }) => (
          <span className="font-mono">{formatUsdc(row.original.totalChargedUsdc)}</span>
        ),
      },
      {
        accessorKey: 'nextChargeAt',
        header: 'Next charge',
        cell: ({ row }) =>
          row.original.status === 'cancelled' || row.original.status === 'lapsed' ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span>{relativeTime(row.original.nextChargeAt)}</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  navigator.clipboard
                    .writeText(row.original.id)
                    .then(() => toast.success('Subscription ID copied'))
                }
              >
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="mr-2 size-4" /> View timeline
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-600"
                onClick={() => toast.success(`Cancel queued for ${row.original.id}`)}
              >
                <Ban className="mr-2 size-4" /> Cancel subscription
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Every customer who is signed up to a recurring plan. Each row tracks one subscription."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv('subscriptions.csv', SUBSCRIPTIONS, [
                  { key: 'id', header: 'ID' },
                  { key: 'planName', header: 'Plan' },
                  { key: 'customerWallet', header: 'Wallet' },
                  { key: 'customerEmail', header: 'Email' },
                  { key: 'amountUsdc', header: 'Amount (smallest units)' },
                  { key: 'interval', header: 'Interval' },
                  { key: 'status', header: 'Status' },
                  { key: 'totalChargedUsdc', header: 'Total charged (smallest units)' },
                  { key: 'createdAt', header: 'Created' },
                ])
                toast.success('Exported subscriptions.csv')
              }}
            >
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() =>
                toast.message('Plans are created on-chain via your hosted checkout — see docs.')
              }
            >
              <Plus className="mr-1.5 size-4" /> New plan
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active', value: SUBSCRIPTIONS.filter((s) => s.status === 'active').length },
          { label: 'At risk', value: SUBSCRIPTIONS.filter((s) => s.status === 'at_risk').length },
          { label: 'Trialing', value: SUBSCRIPTIONS.filter((s) => s.status === 'trialing').length },
          {
            label: 'Lapsed (30d)',
            value: SUBSCRIPTIONS.filter((s) => s.status === 'lapsed').length,
          },
        ].map((c) => (
          <div
            key={c.label}
            className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4"
          >
            <div className="text-muted-foreground text-xs">{c.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-sora text-2xl font-semibold">{c.value}</span>
              <span className="text-muted-foreground text-xs">subscriptions</span>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search by customer wallet, email, plan…"
        emptyTitle="No subscriptions"
        emptyDescription="Send customers your hosted plan URL to start subscribing."
        toolbar={
          <div className="flex flex-wrap items-center gap-1">
            {(
              ['all', 'active', 'trialing', 'at_risk', 'paused', 'cancelled', 'lapsed'] as const
            ).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={[
                  'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                  statusFilter === s
                    ? 'border-[#02C76A] bg-[#02C76A]/10 text-[#02C76A]'
                    : 'border-border/60 hover:bg-muted',
                ].join(' ')}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        }
      />

      <section className="shadow-sub-card border-border/60 bg-background rounded-xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-sora text-base font-semibold">Plans</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Templates customers subscribe to. Created on-chain via your hosted checkout.
            </p>
          </div>
          <Button variant="outline" size="sm">
            Manage plans
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className="border-border/60 rounded-lg border p-4 transition-colors hover:border-[#02C76A]/40"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{p.name}</div>
                <Badge variant="outline" className="text-[10px]">
                  {p.interval}
                </Badge>
              </div>
              <div className="font-sora mt-2 text-xl font-semibold">
                {formatUsdc(p.amountUsdc)}{' '}
                <span className="text-muted-foreground text-xs">USDC</span>
              </div>
              <div className="text-muted-foreground mt-2 text-xs">
                {p.activeSubscribers} active subscribers
              </div>
              {p.trialPeriodDays > 0 ? (
                <div className="text-muted-foreground mt-1 text-xs">
                  {p.trialPeriodDays}-day trial
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
