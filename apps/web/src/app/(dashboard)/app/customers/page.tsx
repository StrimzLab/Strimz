'use client'

import * as React from 'react'
import { Download, MoreHorizontal, Mail, Eye, Copy } from 'lucide-react'
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
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { CUSTOMERS, type Customer } from '@/data/customers'
import { formatUsdc, relativeTime, shortAddress } from '@/data/_seed'

export default function CustomersPage() {
  const totalLtv = CUSTOMERS.reduce((s, c) => s + c.totalSpentUsdc, 0)
  const withSubs = CUSTOMERS.filter((c) => c.activeSubscriptions > 0).length

  const columns: ColumnDef<Customer>[] = React.useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">
              {row.original.name ?? 'Anonymous'}
              {row.original.company ? ` · ${row.original.company}` : ''}
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
        accessorKey: 'totalSpentUsdc',
        header: 'Lifetime spend',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol="USDC" size={14} />
            {formatUsdc(row.original.totalSpentUsdc)}
          </span>
        ),
      },
      {
        accessorKey: 'transactionCount',
        header: 'Transactions',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.transactionCount}</span>
        ),
      },
      {
        accessorKey: 'activeSubscriptions',
        header: 'Active subs',
        cell: ({ row }) =>
          row.original.activeSubscriptions > 0 ? (
            <span className="rounded-full bg-[#02C76A]/10 px-2 py-0.5 text-xs font-medium text-[#02C76A]">
              {row.original.activeSubscriptions}
            </span>
          ) : (
            <span className="text-muted-foreground">0</span>
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
              <DropdownMenuItem>
                <Eye className="mr-2 size-4" /> View timeline
              </DropdownMenuItem>
              {row.original.email ? (
                <DropdownMenuItem>
                  <Mail className="mr-2 size-4" /> Email customer
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
            onClick={() => {
              downloadCsv('customers.csv', CUSTOMERS, [
                { key: 'id', header: 'ID' },
                { key: 'walletAddress', header: 'Wallet' },
                { key: 'email', header: 'Email' },
                { key: 'name', header: 'Name' },
                { key: 'company', header: 'Company' },
                { key: 'totalSpentUsdc', header: 'Total spent (smallest units)' },
                { key: 'transactionCount', header: 'Transactions' },
                { key: 'activeSubscriptions', header: 'Active subs' },
                { key: 'createdAt', header: 'Created' },
                { key: 'lastSeenAt', header: 'Last seen' },
              ])
              toast.success('Exported customers.csv')
            }}
          >
            <Download className="mr-1.5 size-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total customers" value={CUSTOMERS.length.toLocaleString()} />
        <Stat label="With active subscription" value={withSubs.toLocaleString()} />
        <Stat label="Combined LTV" value={`${formatUsdc(totalLtv)} USDC`} />
      </div>

      <DataTable
        columns={columns}
        data={CUSTOMERS}
        searchPlaceholder="Search by name, email, wallet…"
        emptyTitle="No customers yet"
        emptyDescription="Once a wallet pays you, they show up here automatically."
      />
    </div>
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
