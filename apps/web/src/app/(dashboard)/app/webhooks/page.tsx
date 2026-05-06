'use client'

import * as React from 'react'
import {
  Download,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Copy,
  KeyRound,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
} from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { downloadCsv } from '@/lib/csv-export'
import {
  WEBHOOK_ENDPOINTS,
  WEBHOOK_DELIVERIES,
  ALL_EVENT_TYPES,
  type WebhookEndpoint,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
} from '@/data/webhooks'
import { relativeTime } from '@/data/_seed'

const DELIVERY_TONE: Record<
  WebhookDeliveryStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  delivered: 'positive',
  pending: 'info',
  retrying: 'warning',
  permanently_failed: 'danger',
}

export default function WebhooksPage() {
  const totalSuccess24h = WEBHOOK_ENDPOINTS.reduce((s, e) => s + e.successCount24h, 0)
  const totalFail24h = WEBHOOK_ENDPOINTS.reduce((s, e) => s + e.failureCount24h, 0)
  const successRate = totalSuccess24h / Math.max(1, totalSuccess24h + totalFail24h)

  const endpointColumns: ColumnDef<WebhookEndpoint>[] = React.useMemo(
    () => [
      {
        accessorKey: 'url',
        header: 'Endpoint',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.url}</span>
            <span className="text-muted-foreground text-xs">{row.original.description}</span>
          </div>
        ),
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px] capitalize">
            {row.original.mode}
          </Badge>
        ),
      },
      {
        accessorKey: 'events',
        header: 'Events',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.events.length} subscribed
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) =>
          row.original.status === 'active' ? (
            <StatusPill tone="positive">active</StatusPill>
          ) : (
            <StatusPill tone="neutral">disabled</StatusPill>
          ),
      },
      {
        id: 'success_24h',
        header: 'Success rate (24h)',
        cell: ({ row }) => {
          const total = row.original.successCount24h + row.original.failureCount24h
          const rate = total === 0 ? 1 : row.original.successCount24h / total
          return (
            <div className="flex items-center gap-2">
              <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
                <div className="h-full bg-[#02C76A]" style={{ width: `${rate * 100}%` }} />
              </div>
              <span className="font-mono text-xs">{Math.round(rate * 100)}%</span>
            </div>
          )
        },
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
              <DropdownMenuLabel>Endpoint</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  navigator.clipboard
                    .writeText(row.original.url)
                    .then(() => toast.success('URL copied'))
                }
              >
                <Copy className="mr-2 size-4" /> Copy URL
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.success('New signing secret issued — old secret deactivated')}
              >
                <KeyRound className="mr-2 size-4" /> Rotate secret
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {row.original.status === 'active' ? (
                <DropdownMenuItem onClick={() => toast.success(`${row.original.url} disabled`)}>
                  <Pause className="mr-2 size-4" /> Disable
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => toast.success(`${row.original.url} re-enabled`)}>
                  <Play className="mr-2 size-4" /> Enable
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-rose-600 focus:text-rose-600">
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  )

  const deliveryColumns: ColumnDef<WebhookDelivery>[] = React.useMemo(
    () => [
      {
        accessorKey: 'eventType',
        header: 'Event',
        cell: ({ row }) => <code className="text-xs font-medium">{row.original.eventType}</code>,
      },
      {
        accessorKey: 'endpointUrl',
        header: 'Endpoint',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.original.endpointUrl}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={DELIVERY_TONE[row.original.status]}>
            {row.original.status.replace('_', ' ')}
          </StatusPill>
        ),
      },
      {
        accessorKey: 'responseCode',
        header: 'Response',
        cell: ({ row }) =>
          row.original.responseCode ? (
            <code
              className={[
                'text-xs',
                row.original.responseCode >= 400 ? 'text-rose-600' : 'text-muted-foreground',
              ].join(' ')}
            >
              HTTP {row.original.responseCode}
            </code>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: 'attemptCount',
        header: 'Attempts',
        cell: ({ row }) => <span className="text-xs">{row.original.attemptCount}/5</span>,
      },
      {
        accessorKey: 'durationMs',
        header: 'Duration',
        cell: ({ row }) =>
          row.original.durationMs ? (
            <span className="font-mono text-xs">{row.original.durationMs}ms</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
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
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => toast.success(`Replay queued for ${row.original.id.slice(0, 10)}`)}
          >
            <RefreshCw className="mr-1 size-3" /> Replay
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Endpoints that receive event notifications from Strimz. Failed deliveries retry automatically; persistent failures auto-disable the endpoint."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv('webhook-deliveries.csv', WEBHOOK_DELIVERIES, [
                  { key: 'id', header: 'ID' },
                  { key: 'endpointUrl', header: 'Endpoint' },
                  { key: 'eventType', header: 'Event' },
                  { key: 'status', header: 'Status' },
                  { key: 'responseCode', header: 'Response code' },
                  { key: 'attemptCount', header: 'Attempts' },
                  { key: 'durationMs', header: 'Duration (ms)' },
                  { key: 'createdAt', header: 'When' },
                  { key: 'lastError', header: 'Last error' },
                ])
                toast.success('Exported webhook-deliveries.csv')
              }}
            >
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
            <NewEndpointDialog />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Endpoints" value={WEBHOOK_ENDPOINTS.length.toString()} />
        <Stat label="Delivered (24h)" value={totalSuccess24h.toLocaleString()} />
        <Stat
          label="Failed (24h)"
          value={totalFail24h.toLocaleString()}
          tone={totalFail24h > 5 ? 'danger' : undefined}
        />
        <Stat label="Success rate" value={`${Math.round(successRate * 100)}%`} />
      </div>

      <section className="space-y-2">
        <h2 className="font-sora text-base font-semibold">Endpoints</h2>
        <DataTable
          columns={endpointColumns}
          data={WEBHOOK_ENDPOINTS}
          searchPlaceholder="Search by URL, description…"
          emptyTitle="No endpoints"
          emptyDescription="Add your first endpoint to start receiving events."
        />
      </section>

      <section className="space-y-2">
        <h2 className="font-sora text-base font-semibold">Recent deliveries</h2>
        <DataTable
          columns={deliveryColumns}
          data={WEBHOOK_DELIVERIES}
          searchPlaceholder="Search deliveries…"
          emptyTitle="No deliveries"
          emptyDescription="Webhook deliveries will appear here as events fire."
        />
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={[
          'font-sora mt-1 text-2xl font-semibold',
          tone === 'danger' ? 'text-rose-600' : '',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

function NewEndpointDialog() {
  const [open, setOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<string[]>([])
  const toggle = (e: string) =>
    setSelected((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]))
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" >
          <Plus className="mr-1.5 size-4" /> Add endpoint
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add webhook endpoint</DialogTitle>
          <DialogDescription>
            You'll get a signing secret once — copy it immediately, we don't show it again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="wh-url">URL</Label>
            <Input id="wh-url" placeholder="https://your-site.com/webhooks/strimz" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wh-desc">Description</Label>
            <Input id="wh-desc" placeholder="Production receiver" />
          </div>
          <div className="grid gap-1.5">
            <Label>Events ({selected.length} selected)</Label>
            <div className="border-border/60 grid grid-cols-2 gap-1 rounded-md border p-2 text-xs">
              {ALL_EVENT_TYPES.map((e) => (
                <label
                  key={e}
                  className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(e)}
                    onChange={() => toggle(e)}
                  />
                  <code>{e}</code>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false)
              toast.success(`Endpoint added with ${selected.length} events`)
            }}
          >
            Add endpoint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
