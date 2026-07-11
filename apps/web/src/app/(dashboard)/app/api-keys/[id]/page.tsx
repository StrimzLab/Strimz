'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ban, Copy, KeyRound } from 'lucide-react'
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

import { PageHeader } from '@/components/dashboard/page-header'
import { StatusPill } from '@/components/dashboard/data-table'
import { relativeTime } from '@/lib/format'
import { useApiKey, useRevokeApiKey, useRotateApiKey } from '@/hooks/api'

export default function ApiKeyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: key, isLoading, isError, error } = useApiKey(id)
  const revoke = useRevokeApiKey()
  const rotate = useRotateApiKey()
  const [rotatedSecret, setRotatedSecret] = React.useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <PageHeader title="API key" description="Loading…" />
        <div className="border-border/60 bg-muted/30 h-40 animate-pulse rounded-xl border" />
      </div>
    )
  }

  if (isError || !key) {
    return (
      <div className="space-y-6">
        <BackLink />
        <PageHeader title="API key" description="Couldn't load this key." />
        <Card className="border-border/60">
          <CardContent className="p-6 text-sm">
            {error?.message ?? 'Key not found or you don’t have access.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const isRevoked = Boolean(key.revokedAt)

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={key.name}
        description={key.id}
        action={
          !isRevoked ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  rotate.mutate(key.id, {
                    onSuccess: (result) => setRotatedSecret(result.secret),
                  })
                }
                disabled={rotate.isPending}
              >
                <KeyRound className="mr-1.5 size-4" />
                {rotate.isPending ? 'Rotating…' : 'Rotate'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600"
                onClick={() => revoke.mutate(key.id)}
                disabled={revoke.isPending}
              >
                <Ban className="mr-1.5 size-4" /> Revoke
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="space-y-3 p-5 text-sm">
            <Row label="Status">
              {isRevoked ? (
                <StatusPill tone="neutral">revoked</StatusPill>
              ) : (
                <StatusPill tone="positive">active</StatusPill>
              )}
            </Row>
            <Row label="Kind">
              <Badge variant="outline" className="capitalize">
                {key.kind}
              </Badge>
            </Row>
            <Row label="Mode">
              <Badge variant={key.mode === 'live' ? 'default' : 'outline'} className="capitalize">
                {key.mode}
              </Badge>
            </Row>
            <Row label="Prefix">
              <code className="text-xs">
                {key.prefix}
                {'•'.repeat(12)}
                {key.lastFour}
              </code>
            </Row>
            <Row label="Id">
              <div className="flex items-center gap-2">
                <code className="text-xs">{key.id}</code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(key.id)
                    toast.success('Id copied')
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Copy id"
                >
                  <Copy className="size-3" />
                </button>
              </div>
            </Row>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="text-muted-foreground text-xs uppercase tracking-wide">Timeline</div>
            <Row label="Created">
              <span>{relativeTime(key.createdAt)}</span>
            </Row>
            <Row label="Last used">
              <span>{key.lastUsedAt ? relativeTime(key.lastUsedAt) : 'never'}</span>
            </Row>
            {key.revokedAt ? (
              <Row label="Revoked">
                <span>{relativeTime(key.revokedAt)}</span>
              </Row>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="space-y-2 p-5 text-sm">
          <div className="text-muted-foreground text-xs uppercase tracking-wide">
            Scopes ({key.scopes.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {key.scopes.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px]">
                <code>{s}</code>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={rotatedSecret != null} onOpenChange={(o) => !o && setRotatedSecret(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New key issued</DialogTitle>
            <DialogDescription>
              Copy this now. The previous key is already revoked; anything using it will stop
              working immediately.
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
                  toast.success('Key copied')
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
      href="/app/api-keys"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
    >
      <ArrowLeft className="size-3" />
      Back to API keys
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
