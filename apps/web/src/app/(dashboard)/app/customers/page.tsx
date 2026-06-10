'use client'

import * as React from 'react'
import { Download, MoreHorizontal, Mail, Copy } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@strimz/ui'
import type { Customer } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable } from '@/components/dashboard/data-table'
import { downloadCsv } from '@/lib/csv-export'
import { relativeTime, shortAddress } from '@/lib/format'
import { useCustomers } from '@/hooks/api'

/**
 * Customers page.
 *
 * The API's `Customer` shape is intentionally minimal — no aggregated
 * LTV, no transaction count. Those are derived metrics that belong on
 * the analytics surface, not here. This page renders identity +
 * activity (first/last seen) and routes deeper for spend history.
 *
 * Re-render hygiene:
 *   - `select` projects the page envelope into `{rows, count}` so the
 *     two cards above the table don't subscribe to wallet address
 *     changes.
 *   - Search input is debounced via local state → query params. We
 *     don't memoise the params object because the change ID *is* the
 *     thing we want to re-key the query on.
 */

interface CustomersView {
  rows: Customer[]
  count: number
}

export default function CustomersPage() {
  const [search, setSearch] = React.useState('')

  // Debounce so a typed query doesn't fire a request per keystroke.
  const debouncedSearch = useDebounced(search, 250)

  const { data, isLoading, isError, error, refetch } = useCustomers(
    { query: debouncedSearch || undefined, limit: 100 },
    { select: (page): CustomersView => ({ rows: page.data, count: page.data.length }) },
  )

  const columns = React.useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: 'displayName',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">
              {row.original.displayName ?? row.original.email ?? 'Anonymous'}
            </span>
            <span className="text-muted-foreground text-xs">
              {row.original.email ?? '— no email on file'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'walletAddress',
        header: 'Wallet',
        cell: ({ row }) => (
          <code className="text-xs">{shortAddress(row.original.walletAddress)}</code>
        ),
      },
      {
        accessorKey: 'externalRef',
        header: 'External ref',
        cell: ({ row }) =>
          row.original.externalRef ? (
            <code className="text-muted-foreground text-xs">{row.original.externalRef}</code>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'firstSeenAt',
        header: 'First seen',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{relativeTime(row.original.firstSeenAt)}</span>
        ),
      },
      {
        accessorKey: 'lastSeenAt',
        header: 'Last activity',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{relativeTime(row.original.lastSeenAt)}</span>
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
                    .writeText(row.original.walletAddress)
                    .then(() => toast.success('Wallet copied'))
                }
              >
                <Copy className="mr-2 size-4" /> Copy wallet
              </DropdownMenuItem>
              {row.original.email ? (
                <DropdownMenuItem
                  onClick={() =>
                    navigator.clipboard
                      .writeText(row.original.email!)
                      .then(() => toast.success('Email copied'))
                  }
                >
                  <Mail className="mr-2 size-4" /> Copy email
                </DropdownMenuItem>
              ) : null}
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
        title="Customers"
        description="Everyone who has paid you. We add a customer here automatically the first time a wallet pays you."
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={!data || data.rows.length === 0}
            onClick={() => {
              if (!data) return
              downloadCsv('customers.csv', data.rows, [
                { key: 'id', header: 'ID' },
                { key: 'walletAddress', header: 'Wallet' },
                { key: 'email', header: 'Email' },
                { key: 'displayName', header: 'Display name' },
                { key: 'externalRef', header: 'External ref' },
                { key: 'firstSeenAt', header: 'First seen' },
                { key: 'lastSeenAt', header: 'Last seen' },
              ])
              toast.success('Exported customers.csv')
            }}
          >
            <Download className="mr-1.5 size-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Total customers" value={data ? data.count.toLocaleString() : '—'} />
        <Stat
          label="Matching this search"
          value={debouncedSearch ? `${data?.count ?? '—'} of ${data?.count ?? '—'}` : '—'}
        />
      </div>

      {isError ? (
        <ErrorBanner message={error?.message ?? 'Failed to load customers'} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search by name, email, wallet…"
          emptyTitle="No customers yet"
          emptyDescription="Once a wallet pays you, they show up here automatically."
          toolbar={
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter…"
              className="border-border/60 bg-background h-9 rounded-md border px-3 text-xs"
            />
          }
        />
      )}
    </div>
  )
}

/**
 * Local debouncer — keeps the search query stable for 250ms after the
 * last keystroke. Avoids hammering the API while the merchant is still
 * typing. Lives in this file because no other page uses it yet; if a
 * third call site lands, lift to `@/hooks/use-debounced.ts`.
 */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-sora mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
      <div>
        <div className="text-sm font-medium">Couldn’t load customers</div>
        <div className="text-muted-foreground text-xs">{message}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
