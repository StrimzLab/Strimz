'use client'

import * as React from 'react'
import { MoreHorizontal, Plus, Eye, EyeOff, Copy, Ban } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'
import type { ApiKey, ApiKeyScope } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { relativeTime } from '@/lib/format'
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/api'

/**
 * Canonical scope list. Kept in sync with the server enum (which is
 * exported as `apiKeyScopeSchema` in @strimz/shared-types) — we
 * hardcode it here so dropdowns don't have to do a runtime z.enum walk.
 * The server validates anyway; this constant exists for UI ordering.
 */
const ALL_SCOPES: readonly ApiKeyScope[] = [
  'sessions_read',
  'sessions_write',
  'subscriptions_read',
  'subscriptions_write',
  'refunds_read',
  'refunds_write',
  'transactions_read',
  'webhooks_read',
  'webhooks_write',
  'invoices_read',
  'invoices_write',
  'storefronts_read',
  'storefronts_write',
  'agents_read',
  'agents_write',
  'relay_read',
  'relay_write',
] as const

export default function ApiKeysPage() {
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({})

  const { data, isLoading, isError, error, refetch } = useApiKeys(
    { limit: 100 },
    { select: (page) => ({ rows: page.data }) },
  )
  const revokeMutation = useRevokeApiKey()

  const columns = React.useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground text-xs capitalize">
              {row.original.kind} key
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <Badge
            variant={row.original.mode === 'live' ? 'default' : 'outline'}
            className="text-[10px] capitalize"
          >
            {row.original.mode}
          </Badge>
        ),
      },
      {
        accessorKey: 'prefix',
        header: 'Key',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <code className="bg-muted/60 rounded px-1.5 py-0.5 text-xs">
              {revealed[row.original.id]
                ? `${row.original.prefix}${'•'.repeat(20)}${row.original.lastFour}`
                : `${row.original.prefix}${'•'.repeat(12)}${row.original.lastFour}`}
            </code>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setRevealed((s) => ({ ...s, [row.original.id]: !s[row.original.id] }))}
            >
              {revealed[row.original.id] ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
        ),
      },
      {
        accessorKey: 'scopes',
        header: 'Scopes',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.scopes.length === ALL_SCOPES.length
              ? 'Full access'
              : `${row.original.scopes.length} scopes`}
          </span>
        ),
      },
      {
        accessorKey: 'revokedAt',
        header: 'Status',
        cell: ({ row }) =>
          row.original.revokedAt ? (
            <StatusPill tone="neutral">revoked</StatusPill>
          ) : (
            <StatusPill tone="positive">active</StatusPill>
          ),
      },
      {
        accessorKey: 'lastUsedAt',
        header: 'Last used',
        cell: ({ row }) =>
          row.original.lastUsedAt ? (
            <span className="text-muted-foreground text-xs">
              {relativeTime(row.original.lastUsedAt)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">never</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const key = row.original
          const isRevoked = Boolean(key.revokedAt)
          return (
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
                      .writeText(key.prefix)
                      .then(() => toast.success('Prefix copied'))
                  }
                >
                  <Copy className="mr-2 size-4" /> Copy prefix
                </DropdownMenuItem>
                {!isRevoked ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-600"
                      onClick={() => revokeMutation.mutate(key.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <Ban className="mr-2 size-4" /> Revoke
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [revealed, revokeMutation],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        description="Server keys with scoped permissions. You can revoke any key right away — once you do, it stops working immediately."
        action={<NewKeyDialog />}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-medium">Secret keys are shown only once.</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          If you lose a key, revoke it and issue a new one. Strimz never stores the full secret.
        </p>
      </div>

      {isError ? (
        <ErrorBanner message={error?.message ?? 'Failed to load API keys'} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search by name, prefix…"
          emptyTitle="No API keys"
          emptyDescription="Issue your first key to start integrating."
        />
      )}
    </div>
  )
}

/**
 * Issue-key dialog. Holds the plaintext secret in local component
 * state ONLY while the dialog is open — the secret never reaches any
 * cache, query store, or localStorage. Closing the dialog drops the
 * secret from memory.
 */
function NewKeyDialog() {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [mode, setMode] = React.useState<'test' | 'live'>('test')
  const [scopes, setScopes] = React.useState<ApiKeyScope[]>([...ALL_SCOPES])
  const [secret, setSecret] = React.useState<string | null>(null)

  const createMutation = useCreateApiKey()

  const reset = () => {
    setName('')
    setMode('test')
    setScopes([...ALL_SCOPES])
    setSecret(null)
  }

  const handleGenerate = () => {
    if (!name.trim() || scopes.length === 0) return
    createMutation.mutate(
      {
        name: name.trim(),
        kind: 'secret',
        mode,
        scopes: scopes as [ApiKeyScope, ...ApiKeyScope[]],
      },
      {
        onSuccess: (result) => {
          setSecret(result.secret)
        },
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
        <Button size="sm">
          <Plus className="mr-1.5 size-4" /> Issue key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{secret ? 'Your new API key' : 'Issue a new API key'}</DialogTitle>
          <DialogDescription>
            {secret
              ? 'Copy this now — once you close this dialog, the full key will be unrecoverable.'
              : 'Pick a name, mode, and scopes. The full key will be shown once.'}
          </DialogDescription>
        </DialogHeader>

        {secret ? (
          <div className="space-y-3 py-2">
            <code className="bg-muted/60 block break-all rounded-md p-3 font-mono text-xs">
              {secret}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                navigator.clipboard.writeText(secret).then(() => toast.success('Key copied'))
              }
            >
              <Copy className="mr-1.5 size-4" /> Copy to clipboard
            </Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="Production server"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="key-mode">Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as 'test' | 'live')}>
                  <SelectTrigger id="key-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="key-preset">Preset</Label>
                <Select
                  defaultValue="full"
                  onValueChange={(v) =>
                    setScopes(
                      v === 'read'
                        ? ALL_SCOPES.filter((s) => s.endsWith('_read'))
                        : v === 'sessions'
                          ? ['sessions_read', 'sessions_write']
                          : [...ALL_SCOPES],
                    )
                  }
                >
                  <SelectTrigger id="key-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full access</SelectItem>
                    <SelectItem value="read">Read-only</SelectItem>
                    <SelectItem value="sessions">Sessions only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>
                Scopes ({scopes.length} of {ALL_SCOPES.length})
              </Label>
              <div className="border-border/60 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2 text-xs">
                {ALL_SCOPES.map((s) => (
                  <label
                    key={s}
                    className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-1.5 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(s)}
                      onChange={() =>
                        setScopes((cur) =>
                          cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
                        )
                      }
                    />
                    <code>{s}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {secret ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={createMutation.isPending || !name.trim() || scopes.length === 0}
              >
                {createMutation.isPending ? 'Generating…' : 'Generate key'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
      <div>
        <div className="text-sm font-medium">Couldn’t load API keys</div>
        <div className="text-muted-foreground text-xs">{message}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
