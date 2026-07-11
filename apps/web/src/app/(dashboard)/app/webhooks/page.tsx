'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Download,
  MoreHorizontal,
  Plus,
  Pause,
  Play,
  Copy,
  KeyRound,
  RotateCcw,
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
  FieldLabel,
  Label,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@strimz/ui'
import {
  webhookEventNameSchema,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookEndpoint,
  type WebhookEventName,
} from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { downloadCsv } from '@/lib/csv-export'
import { useDashboardMode } from '@/lib/dashboard-mode'
import { relativeTime } from '@/lib/format'
import {
  useCreateWebhookEndpoint,
  useDisableWebhookEndpoint,
  useEnableWebhookEndpoint,
  useReplayWebhookDelivery,
  useRotateWebhookSecret,
  useWebhookDeliveries,
  useWebhookEndpoints,
} from '@/hooks/api'

const ALL_EVENT_TYPES: readonly WebhookEventName[] = webhookEventNameSchema.options

const DELIVERY_TONE: Record<
  WebhookDeliveryStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  delivered: 'positive',
  pending: 'info',
  retrying: 'warning',
  permanently_failed: 'danger',
}

const EM_DASH = '—'

/**
 * Two TanStack Query subscriptions on the same screen. Endpoints
 * (slow-changing) and deliveries (auto-refreshed every 10s in the hook).
 * They're separate queries so a delivery tick doesn't flush endpoints.
 */
export default function WebhooksPage() {
  const endpointsQuery = useWebhookEndpoints(
    { limit: 50 },
    {
      select: (page) => ({
        rows: page.data,
        activeCount: page.data.filter((e) => e.status === 'active').length,
        disabledCount: page.data.filter((e) => e.status === 'disabled').length,
      }),
    },
  )
  const deliveriesQuery = useWebhookDeliveries(
    { limit: 50 },
    {
      select: (page) => ({
        rows: page.data,
        delivered: page.data.filter((d) => d.status === 'delivered').length,
        failed: page.data.filter((d) => d.status === 'permanently_failed').length,
      }),
    },
  )

  const disableMutation = useDisableWebhookEndpoint()
  const enableMutation = useEnableWebhookEndpoint()
  const rotateMutation = useRotateWebhookSecret()
  const replayMutation = useReplayWebhookDelivery()

  const [rotatedSecret, setRotatedSecret] = React.useState<{ url: string; secret: string } | null>(
    null,
  )

  const successRate = React.useMemo(() => {
    if (!deliveriesQuery.data) return 0
    const total = deliveriesQuery.data.delivered + deliveriesQuery.data.failed
    return total === 0 ? 100 : Math.round((100 * deliveriesQuery.data.delivered) / total)
  }, [deliveriesQuery.data])

  const endpointColumns = React.useMemo<ColumnDef<WebhookEndpoint>[]>(
    () => [
      {
        accessorKey: 'url',
        header: 'Endpoint',
        cell: ({ row }) => (
          <Link
            href={`/app/webhooks/endpoints/${row.original.id}`}
            className="flex flex-col leading-tight hover:underline"
          >
            <span className="font-medium">{row.original.url}</span>
            <span className="text-muted-foreground text-xs">
              {row.original.description ?? EM_DASH}
            </span>
          </Link>
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
        accessorKey: 'signingSecretPrefix',
        header: 'Secret prefix',
        cell: ({ row }) => (
          <code className="text-muted-foreground text-xs">{row.original.signingSecretPrefix}…</code>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const ep = row.original
          return (
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
                    navigator.clipboard.writeText(ep.url).then(() => toast.success('URL copied'))
                  }
                >
                  <Copy className="mr-2 size-4" /> Copy URL
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    rotateMutation.mutate(ep.id, {
                      onSuccess: (result) =>
                        setRotatedSecret({ url: ep.url, secret: result.signingSecret }),
                    })
                  }
                  disabled={rotateMutation.isPending}
                >
                  <KeyRound className="mr-2 size-4" /> Rotate secret
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {ep.status === 'active' ? (
                  <DropdownMenuItem
                    onClick={() => disableMutation.mutate(ep.id)}
                    disabled={disableMutation.isPending}
                  >
                    <Pause className="mr-2 size-4" /> Disable
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => enableMutation.mutate(ep.id)}
                    disabled={enableMutation.isPending}
                  >
                    <Play className="mr-2 size-4" /> Enable
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [disableMutation, enableMutation, rotateMutation],
  )

  const deliveryColumns = React.useMemo<ColumnDef<WebhookDelivery>[]>(
    () => [
      {
        accessorKey: 'eventName',
        header: 'Event',
        cell: ({ row }) => (
          <Link
            href={`/app/webhooks/deliveries/${row.original.id}`}
            className="text-xs font-medium hover:underline"
          >
            <code>{row.original.eventName}</code>
          </Link>
        ),
      },
      {
        accessorKey: 'endpointId',
        header: 'Endpoint',
        cell: ({ row }) => (
          <Link
            href={`/app/webhooks/endpoints/${row.original.endpointId}`}
            className="text-muted-foreground text-xs hover:underline"
          >
            <code>{row.original.endpointId.slice(0, 14)}…</code>
          </Link>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={DELIVERY_TONE[row.original.status]}>
            {row.original.status.replace(/_/g, ' ')}
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
            <span className="text-muted-foreground text-xs">{EM_DASH}</span>
          ),
      },
      {
        accessorKey: 'attempt',
        header: 'Attempt',
        cell: ({ row }) => <span className="text-xs">#{row.original.attempt}</span>,
      },
      {
        accessorKey: 'responseMs',
        header: 'Duration',
        cell: ({ row }) =>
          row.original.responseMs !== null ? (
            <span className="font-mono text-xs">{row.original.responseMs}ms</span>
          ) : (
            <span className="text-muted-foreground text-xs">{EM_DASH}</span>
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
        cell: ({ row }) => {
          const d = row.original
          const canReplay = d.status === 'permanently_failed' || d.status === 'retrying'
          if (!canReplay) return null
          return (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.preventDefault()
                replayMutation.mutate(d.id)
              }}
              disabled={replayMutation.isPending}
            >
              <RotateCcw className="mr-1 size-3" /> Replay
            </Button>
          )
        },
      },
    ],
    [replayMutation],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        docsSlug="webhooks"
        description="Endpoints that receive event notifications from Strimz. Failed deliveries retry automatically; persistent failures auto-disable the endpoint."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!deliveriesQuery.data || deliveriesQuery.data.rows.length === 0}
              onClick={() => {
                if (!deliveriesQuery.data) return
                downloadCsv('webhook-deliveries.csv', deliveriesQuery.data.rows, [
                  { key: 'id', header: 'ID' },
                  { key: 'endpointId', header: 'Endpoint' },
                  { key: 'eventName', header: 'Event' },
                  { key: 'status', header: 'Status' },
                  { key: 'responseCode', header: 'Response code' },
                  { key: 'attempt', header: 'Attempts' },
                  { key: 'responseMs', header: 'Duration (ms)' },
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
        <Stat
          label="Endpoints"
          value={endpointsQuery.data ? endpointsQuery.data.rows.length.toString() : EM_DASH}
        />
        <Stat
          label="Delivered (recent)"
          value={deliveriesQuery.data ? deliveriesQuery.data.delivered.toLocaleString() : EM_DASH}
        />
        <Stat
          label="Failed (recent)"
          value={deliveriesQuery.data ? deliveriesQuery.data.failed.toLocaleString() : EM_DASH}
          tone={deliveriesQuery.data && deliveriesQuery.data.failed > 5 ? 'danger' : undefined}
        />
        <Stat label="Success rate" value={deliveriesQuery.data ? `${successRate}%` : EM_DASH} />
      </div>

      <section className="space-y-2">
        <h2 className="font-sora text-base font-semibold">Endpoints</h2>
        {endpointsQuery.isError ? (
          <ErrorBanner
            message={endpointsQuery.error?.message ?? 'Failed to load endpoints'}
            onRetry={endpointsQuery.refetch}
          />
        ) : (
          <DataTable
            columns={endpointColumns}
            data={endpointsQuery.data?.rows ?? []}
            loading={endpointsQuery.isLoading}
            searchPlaceholder="Search by URL, description…"
            emptyTitle="No endpoints"
            emptyDescription="Add your first endpoint to start receiving events."
          />
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-sora text-base font-semibold">Recent deliveries</h2>
        {deliveriesQuery.isError ? (
          <ErrorBanner
            message={deliveriesQuery.error?.message ?? 'Failed to load deliveries'}
            onRetry={deliveriesQuery.refetch}
          />
        ) : (
          <DataTable
            columns={deliveryColumns}
            data={deliveriesQuery.data?.rows ?? []}
            loading={deliveriesQuery.isLoading}
            searchPlaceholder="Search deliveries…"
            emptyTitle="No deliveries"
            emptyDescription="Webhook deliveries will appear here as events fire."
          />
        )}
      </section>

      <RotatedSecretDialog
        state={rotatedSecret}
        onOpenChange={(open) => {
          if (!open) setRotatedSecret(null)
        }}
      />
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
  const activeMode = useDashboardMode()
  // Live mode is disabled until Arc Mainnet ships, so we clamp the
  // initial value even when the global toggle somehow reports 'live'.
  const seedMode: 'test' | 'live' = activeMode === 'live' ? 'test' : activeMode
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [mode, setMode] = React.useState<'test' | 'live'>(seedMode)
  const [events, setEvents] = React.useState<WebhookEventName[]>([])
  const [signingSecret, setSigningSecret] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) setMode(seedMode)
  }, [seedMode, open])

  const createMutation = useCreateWebhookEndpoint()

  const reset = () => {
    setUrl('')
    setDescription('')
    setEvents([])
    setSigningSecret(null)
    setMode(seedMode)
  }

  const closeDialog = () => {
    setOpen(false)
    reset()
  }

  const toggle = (e: WebhookEventName) =>
    setEvents((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]))

  const handleCreate = () => {
    if (!url || events.length === 0) return
    createMutation.mutate(
      {
        url,
        description: description || undefined,
        mode,
        events: events as [WebhookEventName, ...WebhookEventName[]],
      },
      {
        onSuccess: (result) => setSigningSecret(result.signingSecret),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1.5 size-4" /> Add endpoint
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{signingSecret ? 'Signing secret' : 'Add webhook endpoint'}</DialogTitle>
          <DialogDescription>
            {signingSecret
              ? 'Copy this now. Once you close this dialog the full secret is unrecoverable.'
              : "You'll get a signing secret once it's created. Copy it immediately, we don't show it again."}
          </DialogDescription>
        </DialogHeader>

        {signingSecret ? (
          <SecretReveal secret={signingSecret} />
        ) : (
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="wh-url" required>
                URL
              </FieldLabel>
              <Input
                id="wh-url"
                placeholder="https://your-site.com/webhooks/strimz"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="wh-desc" required={false}>
                Description
              </FieldLabel>
              <Input
                id="wh-desc"
                placeholder="Production receiver"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <TooltipProvider delayDuration={100}>
              <div className="flex items-center gap-2 text-xs">
                <Label>Mode:</Label>
                {(['test', 'live'] as const).map((m) => {
                  const disabled = m === 'live'
                  const button = (
                    <button
                      key={m}
                      type="button"
                      onClick={() => !disabled && setMode(m)}
                      disabled={disabled}
                      aria-disabled={disabled}
                      className={[
                        'h-7 rounded-md border px-2 capitalize transition-colors',
                        disabled
                          ? 'border-border/60 text-muted-foreground cursor-not-allowed opacity-70'
                          : mode === m
                            ? 'border-[#02C76A] bg-[#02C76A]/10 text-[#02C76A]'
                            : 'border-border/60 hover:bg-muted',
                      ].join(' ')}
                    >
                      {m}
                    </button>
                  )
                  if (!disabled) return button
                  return (
                    <Tooltip key={m}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">{button}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                        Mainnet coming soon. Live mode unlocks when Arc Mainnet launches.
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            </TooltipProvider>
            <div className="grid gap-1.5">
              <Label>Events ({events.length} selected)</Label>
              <div className="border-border/60 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2 text-xs">
                {ALL_EVENT_TYPES.map((e) => (
                  <label
                    key={e}
                    className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(e)}
                      onChange={() => toggle(e)}
                    />
                    <code>{e}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {signingSecret ? (
            <Button onClick={closeDialog}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending || !url || events.length === 0}
              >
                {createMutation.isPending ? 'Creating…' : 'Add endpoint'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RotatedSecretDialog({
  state,
  onOpenChange,
}: {
  state: { url: string; secret: string } | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={state != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New signing secret</DialogTitle>
          <DialogDescription>
            Copy this now. Once you close this dialog the full secret is unrecoverable. The previous
            secret is already invalidated.
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <>
            <div className="text-muted-foreground text-xs">
              Endpoint: <span className="font-medium">{state.url}</span>
            </div>
            <SecretReveal secret={state.secret} />
          </>
        ) : null}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SecretReveal({ secret }: { secret: string }) {
  return (
    <div className="space-y-3 py-2">
      <code className="bg-muted/60 block break-all rounded-md p-3 font-mono text-xs">{secret}</code>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() =>
          navigator.clipboard.writeText(secret).then(() => toast.success('Secret copied'))
        }
      >
        <Copy className="mr-1.5 size-4" /> Copy to clipboard
      </Button>
    </div>
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
