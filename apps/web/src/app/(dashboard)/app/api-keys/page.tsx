'use client'

import * as React from 'react'
import { MoreHorizontal, Plus, Eye, EyeOff, Copy, Ban } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button, Badge,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { API_KEYS, ALL_SCOPES, type ApiKey } from '@/data/api-keys'
import { relativeTime } from '@/data/_seed'

export default function ApiKeysPage() {
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({})

  const columns: ColumnDef<ApiKey>[] = React.useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">Created by {row.original.createdBy}</span>
        </div>
      ),
    },
    {
      accessorKey: 'mode',
      header: 'Mode',
      cell: ({ row }) => <Badge variant={row.original.mode === 'live' ? 'default' : 'outline'} className="text-[10px] capitalize">{row.original.mode}</Badge>,
    },
    {
      accessorKey: 'prefix',
      header: 'Key',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted/60 px-1.5 py-0.5 text-xs">
            {revealed[row.original.id]
              ? `${row.original.prefix}${'•'.repeat(20)}`
              : `${row.original.prefix.slice(0, 9)}${'•'.repeat(12)}`}
          </code>
          <button
            type="button"
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setRevealed((s) => ({ ...s, [row.original.id]: !s[row.original.id] }))}
          >
            {revealed[row.original.id] ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'scopes',
      header: 'Scopes',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.scopes.length === ALL_SCOPES.length ? 'Full access' : `${row.original.scopes.length} scopes`}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => row.original.status === 'active'
        ? <StatusPill tone="positive">active</StatusPill>
        : <StatusPill tone="neutral">revoked</StatusPill>,
    },
    {
      accessorKey: 'lastUsedAt',
      header: 'Last used',
      cell: ({ row }) => row.original.lastUsedAt
        ? <span className="text-xs text-muted-foreground">{relativeTime(row.original.lastUsedAt)}</span>
        : <span className="text-xs text-muted-foreground">never</span>,
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-8 p-0"><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.prefix).then(() => toast.success('Prefix copied'))}>
              <Copy className="mr-2 size-4" /> Copy prefix
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.status === 'active' ? (
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-600"
                onClick={() => toast.success(`${row.original.name} revoked`)}
              >
                <Ban className="mr-2 size-4" /> Revoke
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [revealed])

  return (
    <div className="space-y-6">
      <PageHeader
        title="API keys"
        description="Server keys with scoped permissions. You can revoke any key right away — once you do, it stops working immediately."
        action={<NewKeyDialog />}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <p className="font-medium">Secret keys are shown only once.</p>
        <p className="mt-0.5 text-xs text-muted-foreground">If you lose a key, revoke it and issue a new one. Strimz never stores the full secret.</p>
      </div>

      <DataTable
        columns={columns}
        data={API_KEYS}
        searchPlaceholder="Search by name, prefix…"
        emptyTitle="No API keys"
        emptyDescription="Issue your first key to start integrating."
      />
    </div>
  )
}

function NewKeyDialog() {
  const [open, setOpen] = React.useState(false)
  const [created, setCreated] = React.useState<string | null>(null)
  const [scopes, setScopes] = React.useState<string[]>([...ALL_SCOPES])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setCreated(null) }}
    >
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1.5 size-4" /> Issue key</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{created ? 'Your new API key' : 'Issue a new API key'}</DialogTitle>
          <DialogDescription>
            {created
              ? 'Copy this now — once you close this dialog, the full key will be unrecoverable.'
              : 'Pick a name, mode, and scopes. The full key will be shown once.'}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3 py-2">
            <code className="block break-all rounded-md bg-muted/60 p-3 font-mono text-xs">{created}</code>
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigator.clipboard.writeText(created).then(() => toast.success('Key copied'))}>
              <Copy className="mr-1.5 size-4" /> Copy to clipboard
            </Button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input id="key-name" placeholder="Production server" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="key-mode">Mode</Label>
                <Select defaultValue="test">
                  <SelectTrigger id="key-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="key-preset">Preset</Label>
                <Select defaultValue="full" onValueChange={(v) => setScopes(v === 'read' ? ALL_SCOPES.filter((s) => s.endsWith('_read')) : v === 'sessions' ? ['sessions_read', 'sessions_write'] : [...ALL_SCOPES])}>
                  <SelectTrigger id="key-preset"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full access</SelectItem>
                    <SelectItem value="read">Read-only</SelectItem>
                    <SelectItem value="sessions">Sessions only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Scopes ({scopes.length} of {ALL_SCOPES.length})</Label>
              <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border/60 p-2 text-xs">
                {ALL_SCOPES.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted">
                    <input type="checkbox" checked={scopes.includes(s)} onChange={() => setScopes((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s])} />
                    <code>{s}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {created ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => setCreated(`sk_test_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 22)}`)}>
                Generate key
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
