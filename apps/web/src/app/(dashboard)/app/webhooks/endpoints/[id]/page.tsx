'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, KeyRound, Pause, Play, RotateCcw } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@strimz/ui'
import type { WebhookDelivery, WebhookDeliveryStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { relativeTime } from '@/lib/format'
import {
  useDisableWebhookEndpoint,
  useEnableWebhookEndpoint,
  useReplayWebhookDelivery,
  useRotateWebhookSecret,
  useWebhookDeliveries,
  useWebhookEndpoint,
} from '@/hooks/api'

const DELIVERY_TONE: Record<
  WebhookDeliveryStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  delivered: 'positive',
  pending: 'info',
  retrying: 'warning',
  permanently_failed: 'danger',
}

export default function EndpointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const endpointQuery = useWebhookEndpoint(id)
  const deliveriesQuery = useWebhookDeliveries({ limit: 50, endpointId: id })
  const disableMutation = useDisableWebhookEndpoint()
  const enableMutation = useEnableWebhookEndpoint()
  const rotateMutation = useRotateWebhookSecret()
  const replayMutation = useReplayWebhookDelivery()

  const [rotatedSecret, setRotatedSecret] = React.useState<string | null>(null)

  const columns = React.useMemo<ColumnDef<WebhookDelivery>[]>(
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
              className={
                row.original.responseCode >= 400
                  ? 'text-xs text-rose-600'
                  : 'text-muted-foreground text-xs'
              }
            >
              HTTP {row.original.responseCode}
            </code>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: 'attempt',
        header: 'Attempt',
        cell: ({ row }) => <span className="text-xs">#{row.original.attempt}</span>,
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

  if (endpointQuery.isLoading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <PageHeader title="Endpoint" description="Loading…" />
        <div className="border-border/60 bg-muted/30 h-40 animate-pulse rounded-xl border" />
      </div>
    )
  }

  if (endpointQuery.isError || !endpointQuery.data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <PageHeader title="Endpoint" description="Couldn't load this endpoint." />
        <Card className="border-border/60">
          <CardContent className="p-6 text-sm">
            {endpointQuery.error?.message ?? 'Endpoint not found or you don’t have access.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const endpoint = endpointQuery.data
  const isActive = endpoint.status === 'active'

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={endpoint.url}
        description={endpoint.description ?? endpoint.id}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                rotateMutation.mutate(endpoint.id, {
                  onSuccess: (result) => setRotatedSecret(result.signingSecret),
                })
              }
              disabled={rotateMutation.isPending}
            >
              <KeyRound className="mr-1.5 size-4" />
              {rotateMutation.isPending ? 'Rotating…' : 'Rotate secret'}
            </Button>
            {isActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => disableMutation.mutate(endpoint.id)}
                disabled={disableMutation.isPending}
              >
                <Pause className="mr-1.5 size-4" /> Disable
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => enableMutation.mutate(endpoint.id)}
                disabled={enableMutation.isPending}
              >
                <Play className="mr-1.5 size-4" /> Enable
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="space-y-3 p-5 text-sm">
            <Row label="Status">
              {isActive ? (
                <StatusPill tone="positive">active</StatusPill>
              ) : (
                <StatusPill tone="neutral">disabled</StatusPill>
              )}
            </Row>
            <Row label="Mode">
              <Badge variant="outline" className="text-[10px] capitalize">
                {endpoint.mode}
              </Badge>
            </Row>
            <Row label="URL">
              <div className="flex items-center gap-2">
                <span className="break-all text-xs">{endpoint.url}</span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(endpoint.url)
                    toast.success('URL copied')
                  }}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Copy URL"
                >
                  <Copy className="size-3" />
                </button>
              </div>
            </Row>
            <Row label="Secret prefix">
              <code className="text-muted-foreground text-xs">{endpoint.signingSecretPrefix}…</code>
            </Row>
            <Row label="Last delivery">
              <span className="text-xs">
                {endpoint.lastDeliveredAt ? relativeTime(endpoint.lastDeliveredAt) : '—'}
              </span>
            </Row>
            <Row label="Created">
              <span className="text-xs">{relativeTime(endpoint.createdAt)}</span>
            </Row>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="space-y-2 p-5 text-sm">
            <div className="text-muted-foreground text-xs uppercase tracking-wide">
              Subscribed events ({endpoint.events.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {endpoint.events.map((e) => (
                <Badge key={e} variant="outline" className="text-[10px]">
                  <code>{e}</code>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="font-sora text-base font-semibold">Recent deliveries</h2>
        <DataTable
          columns={columns}
          data={deliveriesQuery.data?.data ?? []}
          loading={deliveriesQuery.isLoading}
          searchPlaceholder="Search deliveries…"
          emptyTitle="No deliveries yet"
          emptyDescription="Deliveries to this endpoint will appear here as events fire."
        />
      </section>

      <Dialog open={rotatedSecret != null} onOpenChange={(o) => !o && setRotatedSecret(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New signing secret</DialogTitle>
            <DialogDescription>
              Copy this now. Once you close this dialog the full secret is unrecoverable. The
              previous secret is already invalidated.
            </DialogDescription>
          </DialogHeader>
          {rotatedSecret ? (
            <div className="space-y-3 py-2">
              <code className="bg-muted/60 block break-all rounded-md p-3 font-mono text-xs">
                {rotatedSecret}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  void navigator.clipboard.writeText(rotatedSecret)
                  toast.success('Secret copied')
                }}
              >
                <Copy className="mr-1.5 size-4" /> Copy to clipboard
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setRotatedSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/app/webhooks"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
    >
      <ArrowLeft className="size-3" />
      Back to webhooks
    </Link>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div>{children}</div>
    </div>
  )
}
