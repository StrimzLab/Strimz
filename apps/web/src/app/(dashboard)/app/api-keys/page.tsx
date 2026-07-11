'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, MoreHorizontal, Plus, Copy, Ban, KeyRound } from 'lucide-react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@strimz/ui'
import {
  apiKeyScopeSchema,
  type ApiKey,
  type ApiKeyKind,
  type ApiKeyScope,
} from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { useDashboardMode } from '@/lib/dashboard-mode'
import { relativeTime } from '@/lib/format'
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useRotateApiKey } from '@/hooks/api'

const ALL_SCOPES: readonly ApiKeyScope[] = apiKeyScopeSchema.options

const READ_SCOPES = ALL_SCOPES.filter((s) => s.endsWith('_read'))

type RevokedFilter = 'active' | 'revoked' | 'all'

export default function ApiKeysPage() {
  const [filter, setFilter] = React.useState<RevokedFilter>('active')

  const params = React.useMemo(
    () => ({
      limit: 100,
      revoked: filter === 'active' ? false : filter === 'revoked' ? true : undefined,
    }),
    [filter],
  )

  const { data, isLoading, isError, error, refetch } = useApiKeys(params, {
    select: (page) => ({ rows: page.data }),
  })

  const revokeMutation = useRevokeApiKey()
  const rotateMutation = useRotateApiKey()

  const [rotatedSecret, setRotatedSecret] = React.useState<{
    name: string
    secret: string
  } | null>(null)

  const columns = React.useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <Link
            href={`/app/api-keys/${row.original.id}`}
            className="flex flex-col leading-tight hover:underline"
          >
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground text-xs capitalize">
              {row.original.kind} key
            </span>
          </Link>
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
          <code className="bg-muted/60 rounded px-1.5 py-0.5 text-xs">
            {row.original.prefix}
            {'•'.repeat(12)}
            {row.original.lastFour}
          </code>
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
                    navigator.clipboard.writeText(key.id).then(() => toast.success('Id copied'))
                  }
                >
                  <Copy className="mr-2 size-4" /> Copy id
                </DropdownMenuItem>
                {!isRevoked ? (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        rotateMutation.mutate(key.id, {
                          onSuccess: (result) =>
                            setRotatedSecret({ name: key.name, secret: result.secret }),
                        })
                      }
                      disabled={rotateMutation.isPending}
                    >
                      <KeyRound className="mr-2 size-4" /> Rotate
                    </DropdownMenuItem>
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
    [revokeMutation, rotateMutation],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        docsSlug="api-keys"
        description="Server keys with scoped permissions. You can revoke any key right away. Once you do, it stops working immediately."
        action={<NewKeyDialog />}
      />

      <KeyHygieneCallout />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Label className="text-muted-foreground">Show:</Label>
          {(['active', 'revoked', 'all'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={[
                'h-7 rounded-md border px-2 capitalize transition-colors',
                filter === v
                  ? 'border-[#02C76A] bg-[#02C76A]/10 text-[#02C76A]'
                  : 'border-border/60 hover:bg-muted',
              ].join(' ')}
            >
              {v}
            </button>
          ))}
        </div>
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

      <RotatedSecretDialog
        state={rotatedSecret}
        onOpenChange={(open) => {
          if (!open) setRotatedSecret(null)
        }}
      />
    </div>
  )
}

function NewKeyDialog() {
  const activeMode = useDashboardMode()
  const seedMode: 'test' | 'live' = activeMode === 'live' ? 'test' : activeMode
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [kind, setKind] = React.useState<ApiKeyKind>('secret')
  const [mode, setMode] = React.useState<'test' | 'live'>(seedMode)
  const [scopes, setScopes] = React.useState<ApiKeyScope[]>([...ALL_SCOPES])
  const [secret, setSecret] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) setMode(seedMode)
  }, [seedMode, open])

  const createMutation = useCreateApiKey()

  const reset = () => {
    setName('')
    setKind('secret')
    setMode(seedMode)
    setScopes([...ALL_SCOPES])
    setSecret(null)
  }

  const handleGenerate = () => {
    if (!name.trim() || scopes.length === 0) return
    createMutation.mutate(
      {
        name: name.trim(),
        kind,
        mode,
        scopes: scopes as [ApiKeyScope, ...ApiKeyScope[]],
      },
      {
        onSuccess: (result) => setSecret(result.secret),
      },
    )
  }

  const closeDialog = () => {
    setOpen(false)
    reset()
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
              ? 'Copy this now. Once you close this dialog, the full key will be unrecoverable.'
              : 'Pick a name, kind, mode, and scopes. The full key will be shown once.'}
          </DialogDescription>
        </DialogHeader>

        {secret ? (
          <SecretReveal secret={secret} />
        ) : (
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="key-name" required>
                Name
              </FieldLabel>
              <Input
                id="key-name"
                placeholder="Production server"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="key-kind" required>
                  Kind
                </FieldLabel>
                <Select value={kind} onValueChange={(v) => setKind(v as ApiKeyKind)}>
                  <SelectTrigger id="key-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="secret">Secret</SelectItem>
                    <SelectItem value="publishable">Publishable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="key-mode" required>
                  Mode
                </FieldLabel>
                <TooltipProvider delayDuration={100}>
                  <Select value={mode} onValueChange={(v) => setMode(v as 'test' | 'live')}>
                    <SelectTrigger id="key-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="test">Test</SelectItem>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex w-full">
                            <SelectItem value="live" disabled>
                              Live
                            </SelectItem>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[220px] text-xs">
                          Mainnet coming soon. Live mode unlocks when Arc Mainnet launches.
                        </TooltipContent>
                      </Tooltip>
                    </SelectContent>
                  </Select>
                </TooltipProvider>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="key-preset" required>
                  Preset
                </FieldLabel>
                <Select
                  defaultValue="full"
                  onValueChange={(v) =>
                    setScopes(
                      v === 'read'
                        ? [...READ_SCOPES]
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

            <DialogHygieneNote />

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
            <Button onClick={closeDialog}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeDialog}>
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

function RotatedSecretDialog({
  state,
  onOpenChange,
}: {
  state: { name: string; secret: string } | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={state != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New key issued</DialogTitle>
          <DialogDescription>
            Copy this now. The previous key is already revoked; anything using it will stop working
            immediately.
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <>
            <div className="text-muted-foreground text-xs">
              Key: <span className="font-medium">{state.name}</span>
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
          navigator.clipboard.writeText(secret).then(() => toast.success('Key copied'))
        }
      >
        <Copy className="mr-1.5 size-4" /> Copy to clipboard
      </Button>
    </div>
  )
}

function KeyHygieneCallout() {
  return (
    <div className="rounded-xl border border-amber-300/50 bg-amber-100/40 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3.5" />
        </span>
        <div className="space-y-1 text-base">
          <p className="font-medium">One key per service, minimum scopes.</p>
          <p className="text-muted-foreground text-sm">
            A single Full-access key shared across every service means one leak nukes everything —
            you can't rotate it without breaking every consumer at once, and the Last used column
            can't tell you which service touched what. Instead, mint a separate key per workload
            (checkout server, analytics cron, one-off migration), pick only the scopes that workload
            needs, and give each key a distinctive name so you can rotate exactly the affected one
            when something goes wrong.
          </p>
        </div>
      </div>
    </div>
  )
}

function DialogHygieneNote() {
  return (
    <div className="text-muted-foreground flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-100/40 p-2.5 text-xs">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>
        Give this key only the scopes the workload actually needs. Full access is convenient but
        expands the blast radius on any leak.
      </p>
    </div>
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
