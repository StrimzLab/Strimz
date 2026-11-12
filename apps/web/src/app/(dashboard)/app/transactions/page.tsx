'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Button } from '@strimz/ui'
import type { Transaction, TransactionKind, TransactionStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill, type StatusTone } from '@/components/dashboard/data-table'
import {
  DateFilter,
  MultiSelectFilter,
  useDateRange,
  useTableFilters,
  type FilterOption,
} from '@/components/dashboard/filter-bar'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { rangeFileName } from '@/lib/date-range'
import { dateFilter, multiFilter } from '@/lib/table-filters'
import { formatTokenAmount, relativeTime, shortAddress } from '@/lib/format'
import type { LoadedRows } from '@/lib/cursor-pages'
import { transactionKindLabel } from '@/lib/transactions-view'
import { serverRowsOf, useTransactionPages } from '@/hooks/api'
import { EMPTY_STATES } from '@/lib/empty-states'

const STATUS_TONE: Record<TransactionStatus, StatusTone> = {
  confirmed: 'positive',
  pending: 'warning',
  failed: 'danger',
}

const STATUSES: readonly TransactionStatus[] = ['confirmed', 'pending', 'failed']
const KINDS: readonly TransactionKind[] = [
  'one_shot',
  'subscription_charge',
  'invoice_payment',
  'storefront_purchase',
  'refund',
]

const STATUS_OPTIONS: readonly FilterOption<TransactionStatus>[] = STATUSES.map((value) => ({
  value,
  label: value,
  tone: STATUS_TONE[value],
}))
const KIND_OPTIONS: readonly FilterOption<TransactionKind>[] = KINDS.map((value) => ({
  value,
  label: transactionKindLabel(value),
}))

const FILTERS = {
  status: multiFilter(STATUSES),
  kind: multiFilter(KINDS),
  date: dateFilter(),
}

interface TransactionsView {
  rows: Transaction[]
  hasMore: boolean
}

function project(loaded: LoadedRows<Transaction>): TransactionsView {
  return { rows: loaded.rows, hasMore: loaded.hasMore }
}

export default function TransactionsPage() {
  return (
    <React.Suspense>
      <Transactions />
    </React.Suspense>
  )
}

function Transactions() {
  const filters = useTableFilters(FILTERS)
  const { status, kind, date } = filters.state
  const { range, error: dateError } = useDateRange(date)
  const filtered = filters.active

  const queryParams = React.useMemo(
    () => ({
      kind: kind.length > 0 ? kind : undefined,
      status: status.length > 0 ? status : undefined,
      from: range.from,
      to: range.to,
      limit: 100,
    }),
    [kind, status, range.from, range.to],
  )
  const transactionsQuery = useTransactionPages(queryParams, { select: project })
  const { data, isLoading, isError, error, refetch } = transactionsQuery

  const columns = React.useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <Link
            href={`/app/transactions/${row.original.id}`}
            className="text-accent font-mono text-xs hover:underline"
          >
            {row.original.id.slice(0, 14)}…
          </Link>
        ),
      },
      {
        accessorKey: 'kind',
        header: 'Kind',
        cell: ({ row }) => transactionKindLabel(row.original.kind),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol={row.original.currency} size={14} />
            {formatTokenAmount(row.original.amount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'netAmount',
        header: 'Net',
        cell: ({ row }) => (
          <span className="font-mono">
            {formatTokenAmount(row.original.netAmount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'payerAddress',
        header: 'Payer',
        cell: ({ row }) => (
          <code className="text-muted-foreground text-xs">
            {shortAddress(row.original.payerAddress)}
          </code>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={STATUS_TONE[row.original.status]}>{row.original.status}</StatusPill>
        ),
      },
      {
        accessorKey: 'blockTimestamp',
        header: 'When',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {relativeTime(row.original.blockTimestamp)}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        docsSlug="transactions"
        description="Every on-chain payment, subscription charge and refund for your account. Open one to see its details or refund it."
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={!data || data.rows.length === 0}
            onClick={() => {
              if (!data) return
              const fileName = rangeFileName('transactions', range)
              downloadCsv(fileName, data.rows, [
                { key: 'id', header: 'ID' },
                { key: 'kind', header: 'Kind' },
                { key: 'status', header: 'Status' },
                { key: 'amount', header: 'Amount (raw)' },
                { key: 'feeAmount', header: 'Fee (raw)' },
                { key: 'netAmount', header: 'Net (raw)' },
                { key: 'currency', header: 'Currency' },
                { key: 'payerAddress', header: 'Payer' },
                { key: 'onchainTxHash', header: 'On-chain tx' },
                { key: 'sessionId', header: 'Session' },
                { key: 'subscriptionId', header: 'Subscription' },
                { key: 'blockTimestamp', header: 'Block time' },
              ])
              toast.success(`Exported ${fileName}`)
            }}
          >
            <Download className="mr-1.5 size-4" /> Export CSV
          </Button>
        }
      />

      {isError && !data ? (
        <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
          <div>
            <div className="text-sm font-medium">Couldn’t load transactions</div>
            <div className="text-muted-foreground text-xs">
              {error?.message ?? 'Failed to load transactions'}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search by ID, payer, transaction hash…"
          emptyTitle={
            filtered ? 'No transactions match these filters' : EMPTY_STATES.transactions.title
          }
          emptyDescription={
            filtered
              ? 'Try another date range, kind or status.'
              : EMPTY_STATES.transactions.description
          }
          emptyAction={EMPTY_STATES.transactions.action}
          serverRows={serverRowsOf(transactionsQuery)}
          onClearFilters={filtered ? filters.clear : undefined}
          filters={
            <>
              <MultiSelectFilter
                label="Status"
                options={STATUS_OPTIONS}
                selected={status}
                onChange={(next) => filters.set('status', next)}
              />
              <MultiSelectFilter
                label="Kind"
                options={KIND_OPTIONS}
                selected={kind}
                onChange={(next) => filters.set('kind', next)}
              />
              <DateFilter
                value={date}
                error={dateError}
                onChange={(next) => filters.set('date', next)}
              />
            </>
          }
        />
      )}
    </div>
  )
}
