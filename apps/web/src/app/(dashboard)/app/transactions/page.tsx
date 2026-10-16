'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Button } from '@strimz/ui'
import type { Transaction, TransactionKind, TransactionStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { formatTokenAmount, relativeTime, shortAddress } from '@/lib/format'
import type { LoadedRows } from '@/lib/cursor-pages'
import { transactionKindLabel } from '@/lib/transactions-view'
import { serverRowsOf, useTransactionPages } from '@/hooks/api'

const STATUS_TONE: Record<TransactionStatus, 'positive' | 'warning' | 'danger'> = {
  confirmed: 'positive',
  pending: 'warning',
  failed: 'danger',
}

const KIND_FILTERS: ReadonlyArray<TransactionKind | 'all'> = [
  'all',
  'one_shot',
  'subscription_charge',
  'invoice_payment',
  'storefront_purchase',
  'refund',
]

const STATUS_FILTERS: ReadonlyArray<TransactionStatus | 'all'> = [
  'all',
  'confirmed',
  'pending',
  'failed',
]

interface TransactionsView {
  rows: Transaction[]
  hasMore: boolean
}

function project(loaded: LoadedRows<Transaction>): TransactionsView {
  return { rows: loaded.rows, hasMore: loaded.hasMore }
}

export default function TransactionsPage() {
  const [kind, setKind] = React.useState<TransactionKind | 'all'>('all')
  const [status, setStatus] = React.useState<TransactionStatus | 'all'>('all')

  const queryParams = React.useMemo(
    () => ({
      kind: kind === 'all' ? undefined : kind,
      status: status === 'all' ? undefined : status,
      limit: 100,
    }),
    [kind, status],
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
              downloadCsv('transactions.csv', data.rows, [
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
              toast.success('Exported transactions.csv')
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
          emptyTitle="No transactions"
          emptyDescription="Confirmed payments, subscription charges and refunds appear here once they land on-chain."
          serverRows={serverRowsOf(transactionsQuery)}
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <FilterChips
                options={KIND_FILTERS}
                value={kind}
                onChange={setKind}
                label={kindLabel}
              />
              <FilterChips
                options={STATUS_FILTERS}
                value={status}
                onChange={setStatus}
                label={(s) => (s === 'all' ? 'Any status' : s)}
              />
            </div>
          }
        />
      )}
    </div>
  )
}

function kindLabel(kind: TransactionKind | 'all'): string {
  return kind === 'all' ? 'All kinds' : transactionKindLabel(kind)
}

function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<T>
  value: T
  onChange: (next: T) => void
  label: (option: T) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={[
            'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
            value === option
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border/60 hover:bg-muted',
          ].join(' ')}
        >
          {label(option)}
        </button>
      ))}
    </div>
  )
}
