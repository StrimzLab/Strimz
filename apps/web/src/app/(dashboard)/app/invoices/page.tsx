'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, Download, Eye, FileDown, MoreHorizontal, Plus, Send } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@strimz/ui'
import type { Invoice, InvoiceStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { downloadInvoicePdf } from '@/lib/invoice-pdf'
import { formatTokenAmount, relativeTime, tokenAmountToNumber } from '@/lib/format'
import { useInvoices, useMerchantMe, useSendInvoice, useVoidInvoice } from '@/hooks/api'

const STATUS_TONE: Record<InvoiceStatus, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  paid: 'positive',
  sent: 'info',
  draft: 'neutral',
  overdue: 'danger',
  void: 'neutral',
}

interface InvoicesView {
  rows: Invoice[]
  outstanding: number
  outstandingCount: number
  paid30dCount: number
  paid30d: number
  overdueCount: number
  overdueTotal: number
}

function projectInvoices(page: { data: Invoice[] }): InvoicesView {
  const now = Date.now()
  const thirtyDays = 30 * 86_400_000
  let outstanding = 0
  let outstandingCount = 0
  let paid30d = 0
  let paid30dCount = 0
  let overdueCount = 0
  let overdueTotal = 0
  for (const inv of page.data) {
    const total = tokenAmountToNumber(inv.total)
    if (inv.status === 'sent' || inv.status === 'overdue') {
      outstanding += total
      outstandingCount++
    }
    if (inv.status === 'paid' && inv.paidAt && now - +new Date(inv.paidAt) < thirtyDays) {
      paid30d += total
      paid30dCount++
    }
    if (inv.status === 'overdue') {
      overdueCount++
      overdueTotal += total
    }
  }
  return {
    rows: page.data,
    outstanding,
    outstandingCount,
    paid30d,
    paid30dCount,
    overdueCount,
    overdueTotal,
  }
}

export default function InvoicesPage() {
  const router = useRouter()
  const { data, isLoading, isError, error, refetch } = useInvoices(
    { limit: 100 },
    { select: projectInvoices },
  )
  const { data: merchant } = useMerchantMe()
  const sendMutation = useSendInvoice()
  const voidMutation = useVoidInvoice()

  const handleDownload = React.useCallback(
    async (inv: Invoice) => {
      try {
        await downloadInvoicePdf(inv, merchant ?? null)
      } catch (err) {
        toast.error(`Could not render PDF: ${(err as Error).message}`)
      }
    },
    [merchant],
  )

  const columns = React.useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Invoice',
        cell: ({ row }) => (
          <Link
            href={`/app/invoices/${row.original.id}`}
            className="font-mono text-sm font-medium hover:text-[#02C76A] hover:underline"
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.customerName ?? '—'}</span>
            <span className="text-muted-foreground text-xs">
              {row.original.customerEmail ?? 'no email on file'}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'total',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol={row.original.currency} size={14} />
            {formatTokenAmount(row.original.total, row.original.currency)}
          </span>
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
        accessorKey: 'dueAt',
        header: 'Due',
        cell: ({ row }) => (
          <span
            className={
              row.original.status === 'overdue'
                ? 'font-medium text-rose-600'
                : 'text-muted-foreground'
            }
          >
            {relativeTime(row.original.dueAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const inv = row.original
          const canSend = inv.status === 'draft' || inv.status === 'sent'
          const canVoid = inv.status !== 'paid' && inv.status !== 'void'
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Invoice {inv.number}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.push(`/app/invoices/${inv.id}`)}>
                  <Eye className="mr-2 size-4" /> View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDownload(inv)}>
                  <FileDown className="mr-2 size-4" /> Download PDF
                </DropdownMenuItem>
                {canSend ? (
                  <DropdownMenuItem
                    onClick={() => sendMutation.mutate(inv.id)}
                    disabled={sendMutation.isPending}
                  >
                    <Send className="mr-2 size-4" /> {inv.status === 'draft' ? 'Send' : 'Resend'}
                  </DropdownMenuItem>
                ) : null}
                {canVoid ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-600"
                      onClick={() => voidMutation.mutate(inv.id)}
                      disabled={voidMutation.isPending}
                    >
                      <Ban className="mr-2 size-4" /> Void
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [handleDownload, router, sendMutation, voidMutation],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        docsSlug="invoices"
        description="Hosted, branded payment pages with line items. Each invoice is backed by a real PaymentSession."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data || data.rows.length === 0}
              onClick={() => {
                if (!data) return
                downloadCsv('invoices.csv', data.rows, [
                  { key: 'number', header: 'Number' },
                  { key: 'customerName', header: 'Customer' },
                  { key: 'customerEmail', header: 'Email' },
                  { key: 'total', header: 'Total (raw)' },
                  { key: 'currency', header: 'Currency' },
                  { key: 'status', header: 'Status' },
                  { key: 'createdAt', header: 'Created' },
                  { key: 'dueAt', header: 'Due' },
                ])
                toast.success('Exported invoices.csv')
              }}
            >
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
            <Button size="sm" asChild>
              <Link href="/app/invoices/new">
                <Plus className="mr-1.5 size-4" /> New invoice
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Outstanding"
          value={
            data
              ? `${data.outstanding.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
              : '—'
          }
          note={data ? `${data.outstandingCount} invoices` : undefined}
        />
        <Stat
          label="Paid (30d)"
          value={
            data
              ? `${data.paid30d.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
              : '—'
          }
          note={data ? `${data.paid30dCount} invoices` : undefined}
        />
        <Stat
          label="Overdue"
          value={data ? data.overdueCount.toString() : '—'}
          note={
            data
              ? `${data.overdueTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
              : undefined
          }
          tone={data && data.overdueCount > 0 ? 'danger' : undefined}
        />
      </div>

      {isError ? (
        <ErrorBanner message={error?.message ?? 'Failed to load invoices'} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search by number, customer, email…"
          emptyTitle="No invoices yet"
          emptyDescription="Create your first invoice to send a hosted payment link to a customer."
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
        className={`font-sora mt-1 text-2xl font-semibold ${tone === 'danger' ? 'text-rose-600' : ''}`}
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
        <div className="text-sm font-medium">Couldn&apos;t load invoices</div>
        <div className="text-muted-foreground text-xs">{message}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
