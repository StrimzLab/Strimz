'use client'

import * as React from 'react'
import { Download, History, MoreHorizontal, Mail, Copy } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@strimz/ui'
import type { Customer } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable } from '@/components/dashboard/data-table'
import { downloadCsv } from '@/lib/csv-export'
import { relativeTime, shortAddress } from '@/lib/format'
import { useCustomers } from '@/hooks/api'

interface EmailHistoryEntry {
  email: string
  seenAt: string
}

/**
 * Reads the `emailHistory` array we stash on Customer.metadata during
 * hosted-checkout attach-payer. Returns the newest entry first so the
 * current email is always at the top when we render.
 */
function readEmailHistory(customer: Customer): EmailHistoryEntry[] {
  const bag = (customer.metadata ?? {}) as Record<string, unknown>
  const raw = bag.emailHistory
  if (!Array.isArray(raw)) return []
  const entries = raw.filter(
    (entry): entry is EmailHistoryEntry =>
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as EmailHistoryEntry).email === 'string' &&
      typeof (entry as EmailHistoryEntry).seenAt === 'string',
  )
  return [...entries].sort((a, b) => +new Date(b.seenAt) - +new Date(a.seenAt))
}

/**
 * Customers page.
 *
 * The API's `Customer` shape is intentionally minimal. No aggregated
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
  const [historyCustomer, setHistoryCustomer] = React.useState<Customer | null>(null)

  const { data, isLoading, isError, error, refetch } = useCustomers(
    { limit: 100 },
    { select: (page): CustomersView => ({ rows: page.data, count: page.data.length }) },
  )

  const columns = React.useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: 'displayName',
        header: 'Customer',
        cell: ({ row }) => {
          const history = readEmailHistory(row.original)
          const extraCount = Math.max(0, history.length - 1)
          return (
            <div className="flex flex-col leading-tight">
              <span className="font-medium">
                {row.original.displayName ?? row.original.email ?? 'Anonymous'}
              </span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">
                  {row.original.email ?? 'no email on file'}
                </span>
                {extraCount > 0 ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setHistoryCustomer(row.original)}
                          className="inline-flex items-center rounded-full border border-[#02C76A]/30 bg-[#02C76A]/10 px-1.5 text-[10px] font-medium text-[#02C76A] hover:bg-[#02C76A]/15"
                        >
                          +{extraCount} more
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                        This wallet has paid with {history.length} different emails. Click for the
                        full history.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : null}
              </div>
            </div>
          )
        },
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
        cell: ({ row }) => {
          const history = readEmailHistory(row.original)
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
                {history.length > 1 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setHistoryCustomer(row.original)}>
                      <History className="mr-2 size-4" /> View email history
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        docsSlug="customers"
        description="Everyone who has paid you. We identify customers by wallet address, so different emails paying with the same wallet share one row. Prior emails are preserved in the customer's metadata."
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
        />
      )}

      <EmailHistoryDialog customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />
    </div>
  )
}

function EmailHistoryDialog({
  customer,
  onClose,
}: {
  customer: Customer | null
  onClose: () => void
}) {
  const history = React.useMemo(() => (customer ? readEmailHistory(customer) : []), [customer])

  return (
    <Dialog open={!!customer} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email history</DialogTitle>
          <DialogDescription>
            Every email this wallet used at checkout. Newest first. The customer&apos;s current
            email (top) is the one receipts go to.
          </DialogDescription>
        </DialogHeader>
        {customer ? (
          <div className="space-y-3">
            <div className="border-border/60 bg-muted/30 rounded-md border p-3 text-xs">
              <div className="text-muted-foreground">Wallet</div>
              <code className="mt-1 block break-all font-mono">{customer.walletAddress}</code>
            </div>
            {history.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No email history recorded yet.
              </p>
            ) : (
              <ol className="space-y-2">
                {history.map((entry, idx) => (
                  <li
                    key={`${entry.email}-${entry.seenAt}`}
                    className="border-border/60 flex items-start justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{entry.email}</span>
                        {idx === 0 ? (
                          <span className="inline-flex items-center rounded-full border border-[#02C76A]/30 bg-[#02C76A]/10 px-1.5 text-[10px] font-medium text-[#02C76A]">
                            current
                          </span>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        seen {relativeTime(entry.seenAt)}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-8 shrink-0 p-0"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(entry.email)
                          .then(() => toast.success('Email copied'))
                      }
                      aria-label="Copy email"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
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
