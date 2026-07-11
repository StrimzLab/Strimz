'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardContent } from '@strimz/ui'
import type { WebhookDeliveryStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { StatusPill } from '@/components/dashboard/data-table'
import { relativeTime } from '@/lib/format'
import { useReplayWebhookDelivery, useWebhookDelivery } from '@/hooks/api'

const STATUS_TONE: Record<
  WebhookDeliveryStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  delivered: 'positive',
  pending: 'info',
  retrying: 'warning',
  permanently_failed: 'danger',
}

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: delivery, isLoading, isError, error } = useWebhookDelivery(id)
  const replay = useReplayWebhookDelivery()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <PageHeader title="Delivery" description="Loading…" />
        <div className="border-border/60 bg-muted/30 h-40 animate-pulse rounded-xl border" />
      </div>
    )
  }

  if (isError || !delivery) {
    return (
      <div className="space-y-6">
        <BackLink />
        <PageHeader title="Delivery" description="Couldn't load this delivery." />
        <Card className="border-border/60">
          <CardContent className="p-6 text-sm">
            {error?.message ?? 'Delivery not found or you don’t have access.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const canReplay = delivery.status === 'permanently_failed' || delivery.status === 'retrying'
  const prettyPayload = JSON.stringify(delivery.requestPayload, null, 2)

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader title={delivery.eventName} description={delivery.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="space-y-3 p-5 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Status</div>
              <div className="mt-1">
                <StatusPill tone={STATUS_TONE[delivery.status]}>
                  {delivery.status.replace(/_/g, ' ')}
                </StatusPill>
              </div>
            </div>
            <Row label="Attempt">
              <Badge variant="outline">#{delivery.attempt}</Badge>
            </Row>
            <Row label="Endpoint">
              <Link
                href={`/app/webhooks/endpoints/${delivery.endpointId}`}
                className="text-xs text-[#02C76A] hover:underline"
              >
                <code>{delivery.endpointId}</code>
              </Link>
            </Row>
            <Row label="Delivery id">
              <CopyableCode value={delivery.deliveryId} label="Delivery id copied" />
            </Row>
            <Row label="Event id">
              <CopyableCode value={delivery.eventId} label="Event id copied" />
            </Row>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Timeline</div>
            <Row label="Created">
              <span>{relativeTime(delivery.createdAt)}</span>
            </Row>
            {delivery.deliveredAt ? (
              <Row label="Delivered">
                <span>{relativeTime(delivery.deliveredAt)}</span>
              </Row>
            ) : null}
            {delivery.nextAttemptAt ? (
              <Row label="Next attempt">
                <span>{relativeTime(delivery.nextAttemptAt)}</span>
              </Row>
            ) : null}
            <Row label="Response code">
              {delivery.responseCode ? (
                <code
                  className={
                    delivery.responseCode >= 400
                      ? 'text-xs text-rose-600'
                      : 'text-muted-foreground text-xs'
                  }
                >
                  HTTP {delivery.responseCode}
                </code>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </Row>
            <Row label="Duration">
              {delivery.responseMs != null ? (
                <span className="font-mono text-xs">{delivery.responseMs}ms</span>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </Row>
            {delivery.lastError ? (
              <Row label="Last error">
                <p className="text-foreground whitespace-pre-wrap break-words text-xs">
                  {delivery.lastError}
                </p>
              </Row>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Section title="Request payload">
        <CodeBlock text={prettyPayload} onCopyLabel="Payload copied" />
      </Section>

      {delivery.responseBody ? (
        <Section title="Response body">
          <CodeBlock text={delivery.responseBody} onCopyLabel="Response copied" />
        </Section>
      ) : null}

      {canReplay ? (
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-sm font-medium">Re-enqueue this delivery</div>
              <p className="text-muted-foreground text-xs">
                Resets attempt count to 1 and pushes the delivery back onto the scheduler queue.
              </p>
            </div>
            <Button
              onClick={() => replay.mutate(delivery.id)}
              disabled={replay.isPending}
              className="shrink-0"
            >
              <RotateCcw className="mr-1.5 size-4" />
              {replay.isPending ? 'Re-enqueuing…' : 'Replay'}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-sora text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function CopyableCode({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="text-xs">{value}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value)
          toast.success(label)
        }}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Copy"
      >
        <Copy className="size-3" />
      </button>
    </div>
  )
}

function CodeBlock({ text, onCopyLabel }: { text: string; onCopyLabel: string }) {
  return (
    <div className="border-border/60 relative rounded-lg border">
      <pre className="bg-muted/30 max-h-96 overflow-auto rounded-lg p-4 font-mono text-xs">
        {text}
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="absolute right-2 top-2 h-7 px-2 text-xs"
        onClick={() => {
          void navigator.clipboard.writeText(text)
          toast.success(onCopyLabel)
        }}
      >
        <Copy className="mr-1 size-3" /> Copy
      </Button>
    </div>
  )
}
