'use client'

import * as React from 'react'
import { Download, FileDown, MoreHorizontal, Plus, Send, Ban, Eye } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button,
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
  Textarea,
} from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { downloadCsv } from '@/lib/csv-export'
import { downloadInvoicePdf } from '@/lib/invoice-pdf'
import { INVOICES, type Invoice, type InvoiceStatus } from '@/data/invoices'
import { formatUsdc, relativeTime } from '@/data/_seed'

const STATUS_TONE: Record<InvoiceStatus, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  paid: 'positive',
  sent: 'info',
  draft: 'neutral',
  overdue: 'danger',
  void: 'neutral',
}

export default function InvoicesPage() {
  const totalOutstanding = INVOICES.filter(
    (i) => i.status === 'sent' || i.status === 'overdue',
  ).reduce((s, i) => s + i.totalUsdc, 0)
  const totalPaid30d = INVOICES.filter(
    (i) => i.status === 'paid' && i.paidAt && Date.now() - +new Date(i.paidAt) < 30 * 86_400_000,
  ).reduce((s, i) => s + i.totalUsdc, 0)

  const columns: ColumnDef<Invoice>[] = React.useMemo(
    () => [
      {
        accessorKey: 'number',
        header: 'Invoice',
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">{row.original.number}</span>
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">
              {row.original.customerCompany ?? row.original.customerName}
            </span>
            <span className="text-muted-foreground text-xs">{row.original.customerEmail}</span>
          </div>
        ),
      },
      {
        accessorKey: 'totalUsdc',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="font-mono">{formatUsdc(row.original.totalUsdc)} USDC</span>
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
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Invoice {row.original.number}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => downloadInvoicePdf(row.original)}>
                <FileDown className="mr-2 size-4" /> Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="mr-2 size-4" /> View
              </DropdownMenuItem>
              {row.original.status === 'draft' || row.original.status === 'sent' ? (
                <DropdownMenuItem
                  onClick={() => toast.success(`Invoice ${row.original.number} sent`)}
                >
                  <Send className="mr-2 size-4" />{' '}
                  {row.original.status === 'draft' ? 'Send' : 'Resend'}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {row.original.status !== 'paid' && row.original.status !== 'void' ? (
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600"
                  onClick={() => toast.success(`Invoice ${row.original.number} voided`)}
                >
                  <Ban className="mr-2 size-4" /> Void
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
        title="Invoices"
        description="Hosted, branded payment pages with line items. Each invoice is backed by a real PaymentSession."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv('invoices.csv', INVOICES, [
                  { key: 'number', header: 'Number' },
                  { key: 'customerName', header: 'Customer' },
                  { key: 'customerEmail', header: 'Email' },
                  { key: 'totalUsdc', header: 'Total (smallest units)' },
                  { key: 'status', header: 'Status' },
                  { key: 'createdAt', header: 'Created' },
                  { key: 'dueAt', header: 'Due' },
                ])
                toast.success('Exported invoices.csv')
              }}
            >
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
            <NewInvoiceDialog />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Outstanding"
          value={`${formatUsdc(totalOutstanding)} USDC`}
          note={`${INVOICES.filter((i) => i.status === 'sent' || i.status === 'overdue').length} invoices`}
        />
        <Stat
          label="Paid (30d)"
          value={`${formatUsdc(totalPaid30d)} USDC`}
          note={`${INVOICES.filter((i) => i.status === 'paid').length} invoices`}
        />
        <Stat
          label="Overdue"
          value={INVOICES.filter((i) => i.status === 'overdue').length.toString()}
          note={`${formatUsdc(INVOICES.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.totalUsdc, 0))} USDC`}
          tone="danger"
        />
      </div>

      <DataTable
        columns={columns}
        data={INVOICES}
        searchPlaceholder="Search by number, customer, email…"
        emptyTitle="No invoices yet"
        emptyDescription="Create your first invoice to send a hosted payment link to a customer."
      />
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

function NewInvoiceDialog() {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1.5 size-4" /> New invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create invoice</DialogTitle>
          <DialogDescription>
            Strimz will email it to the customer with a hosted payment link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="iv-customer">Customer name</Label>
            <Input id="iv-customer" placeholder="Acme Inc." />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="iv-email">Customer email</Label>
            <Input id="iv-email" type="email" placeholder="ap@acme.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="iv-amount">Total (USDC)</Label>
              <Input id="iv-amount" type="number" step="0.01" placeholder="500.00" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="iv-due">Due in (days)</Label>
              <Input id="iv-due" type="number" defaultValue={14} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="iv-note">Note (optional)</Label>
            <Textarea id="iv-note" placeholder="Net 14" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false)
              toast.success('Invoice created (mock)')
            }}
          >
            Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
