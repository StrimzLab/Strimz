'use client'

import * as React from 'react'
import { Copy, Download, ExternalLink, Loader2, MoreHorizontal, PenLine } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { getTokenAddress } from '@strimz/shared-config'
import { env } from '@/lib/env'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@strimz/ui'
import type { Refund, RefundStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { NewRefundDialog } from '@/components/dashboard/refunds/new-refund-dialog'
import { useRefundSigner } from '@/components/dashboard/refunds/use-refund-signer'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { formatTokenAmount, relativeTime, shortAddress } from '@/lib/format'
import { refundCards, summaryValue } from '@/lib/stats-summary'
import type { LoadedRows } from '@/lib/cursor-pages'
import { serverRowsOf, useRefundPages, useStatsSummary } from '@/hooks/api'

const STATUS_TONE: Record<RefundStatus, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  completed: 'positive',
  submitted: 'info',
  awaiting_signature: 'warning',
  pending: 'info',
  failed: 'danger',
  cancelled: 'neutral',
}

interface RefundsView {
  rows: Refund[]
  hasMore: boolean
}

function projectRefunds(loaded: LoadedRows<Refund>): RefundsView {
  return { rows: loaded.rows, hasMore: loaded.hasMore }
}

export default function RefundsPage() {
  const refundsQuery = useRefundPages({ limit: 100 }, { select: projectRefunds })
  const { data, isLoading, isError, error, refetch } = refundsQuery
  const summaryQuery = useStatsSummary({ select: (summary) => refundCards(summary.refunds) })
  const cards = summaryQuery.data
  const { sign: signRefund, isSigning } = useRefundSigner()
  const [signingId, setSigningId] = React.useState<string | null>(null)

  const handleSignRow = React.useCallback(
    async (refund: Refund) => {
      // We only have `signingInstructions` on the create call. For a
      // row already awaiting_signature, we reconstruct the transfer
      // from the refund + transaction fields. Amount is on the refund;
      // the token address must come from currency + mode via a small
      // client-side lookup.
      const tokenAddress = getTokenAddress(env.arcEnvironment, refund.currency)
      setSigningId(refund.id)
      try {
        await signRefund({
          refundId: refund.id,
          instructions: {
            token: tokenAddress,
            to: refund.payerAddress,
            amount: refund.amount,
            note: refund.note ?? `Refund for transaction ${refund.transactionId}`,
          },
        })
      } catch (err) {
        toast.error(`Sign failed: ${(err as Error).message}`)
      } finally {
        setSigningId(null)
      }
    },
    [signRefund],
  )

  const columns = React.useMemo<ColumnDef<Refund>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Refund',
        cell: ({ row }) => <code className="text-xs">{row.original.id.slice(0, 14)}…</code>,
      },
      {
        accessorKey: 'transactionId',
        header: 'Original tx',
        cell: ({ row }) => (
          <code className="text-muted-foreground text-xs">
            {row.original.transactionId.slice(0, 14)}…
          </code>
        ),
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
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ row }) => (
          <span className="capitalize">{row.original.reason.replace(/_/g, ' ')}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={STATUS_TONE[row.original.status]}>
            {row.original.status.replace(/_/g, ' ')}
          </StatusPill>
        ),
      },
      {
        accessorKey: 'payerAddress',
        header: 'To wallet',
        cell: ({ row }) => (
          <code className="text-xs">{shortAddress(row.original.payerAddress)}</code>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{relativeTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const rf = row.original
          const { refundTxHash } = rf
          const canSign = rf.status === 'awaiting_signature'
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {canSign ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => void handleSignRow(rf)}
                      disabled={isSigning && signingId === rf.id}
                    >
                      {isSigning && signingId === rf.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <PenLine className="mr-2 size-4" />
                      )}
                      Sign & submit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  onClick={() =>
                    navigator.clipboard
                      .writeText(rf.id)
                      .then(() => toast.success('Refund ID copied'))
                  }
                >
                  <Copy className="mr-2 size-4" /> Copy ID
                </DropdownMenuItem>
                {refundTxHash ? (
                  <DropdownMenuItem
                    onClick={() =>
                      navigator.clipboard
                        .writeText(refundTxHash)
                        .then(() => toast.success('Tx hash copied'))
                    }
                  >
                    <ExternalLink className="mr-2 size-4" /> Copy tx hash
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [handleSignRow, isSigning, signingId],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        docsSlug="refunds"
        description="Issue full or partial refunds. You sign each refund from your own wallet, so Strimz never holds your funds."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data || data.rows.length === 0}
              onClick={() => {
                if (!data) return
                downloadCsv('refunds.csv', data.rows, [
                  { key: 'id', header: 'ID' },
                  { key: 'transactionId', header: 'Original transaction' },
                  { key: 'amount', header: 'Amount (raw)' },
                  { key: 'currency', header: 'Currency' },
                  { key: 'reason', header: 'Reason' },
                  { key: 'status', header: 'Status' },
                  { key: 'refundTxHash', header: 'On-chain tx' },
                  { key: 'createdAt', header: 'Created' },
                  { key: 'completedAt', header: 'Completed' },
                ])
                toast.success('Exported refunds.csv')
              }}
            >
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
            <NewRefundDialog onSignRequested={signRefund} />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Completed"
          value={summaryValue(summaryQuery, (c) => c.completed)}
          note={cards?.completedNote}
        />
        <Stat
          label="Awaiting signature"
          value={summaryValue(summaryQuery, (c) => c.awaitingSignature)}
        />
        <Stat
          label="Failed"
          value={summaryValue(summaryQuery, (c) => c.failed)}
          tone={cards && cards.failedCount > 0 ? 'danger' : undefined}
        />
      </div>

      {isError && !data ? (
        <ErrorBanner message={error?.message ?? 'Failed to load refunds'} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search by refund ID, original tx, wallet…"
          emptyTitle="No refunds"
          emptyDescription="Refunds you create from confirmed transactions appear here."
          serverRows={serverRowsOf(refundsQuery)}
        />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note?: string
  tone?: 'danger'
}) {
  return (
    <div className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={[
          'font-sora mt-1 text-2xl font-semibold',
          tone === 'danger' ? 'text-rose-600' : '',
        ].join(' ')}
      >
        {value}
      </div>
      {note ? <div className="text-muted-foreground mt-1 text-xs">{note}</div> : null}
    </div>
  )
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
      <div>
        <div className="text-sm font-medium">Couldn’t load refunds</div>
        <div className="text-muted-foreground text-xs">{message}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
