'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Copy, Loader2 } from 'lucide-react'
import { Button, Card, CardContent } from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { formatTokenAmount, relativeTime } from '@/lib/format'
import { billingLabel } from '@/lib/plans-view'
import {
  useCustomer,
  useInvoices,
  usePaymentSessions,
  useRefunds,
  useSubscriptions,
  useTransactions,
} from '@/hooks/api'

const SECTION_LIMIT = 25

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: customer, isPending, isError } = useCustomer(id)
  const sessions = usePaymentSessions({ customerId: id, limit: SECTION_LIMIT })
  const subscriptions = useSubscriptions({ customerId: id, limit: SECTION_LIMIT })
  const transactions = useTransactions({ customerId: id, limit: SECTION_LIMIT })
  const refunds = useRefunds({ customerId: id, limit: SECTION_LIMIT })
  const invoices = useInvoices({ customerId: id, limit: SECTION_LIMIT })

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-accent size-6 animate-spin" />
      </div>
    )
  }
  if (isError || !customer) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="p-6 text-sm text-rose-600 dark:text-rose-400">
            Customer not found.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={customer.displayName ?? customer.email ?? 'Anonymous customer'}
        description={`First seen ${relativeTime(customer.firstSeenAt)}. Last active ${relativeTime(customer.lastSeenAt)}.`}
      />

      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <Row label="Wallet">
            <CopyValue value={customer.walletAddress} />
          </Row>
          <Row label="Receipts go to">
            {customer.email ? (
              <CopyValue value={customer.email} />
            ) : (
              <span className="text-muted-foreground">No email yet</span>
            )}
          </Row>
          {customer.externalRef ? (
            <Row label="External ref">
              <CopyValue value={customer.externalRef} />
            </Row>
          ) : null}
          <Row label="First seen">
            <span>{new Date(customer.firstSeenAt).toLocaleDateString()}</span>
          </Row>
          <Row label="Last active">
            <span>{relativeTime(customer.lastSeenAt)}</span>
          </Row>
        </CardContent>
      </Card>

      <Section
        title="Payments"
        empty="Payment links this customer opens will show here."
        query={sessions}
        row={(s) => ({
          key: s.id,
          href: `/app/payment-sessions/${s.id}`,
          cells: [
            formatTokenAmount(s.amount, s.currency),
            s.description ?? 'Payment link',
            statusLabel(s.status),
            relativeTime(s.createdAt),
          ],
        })}
      />

      <Section
        title="Subscriptions"
        empty="Plans this customer subscribes to will show here."
        query={subscriptions}
        row={(s) => ({
          key: s.id,
          href: `/app/subscriptions/${s.id}`,
          cells: [
            `${formatTokenAmount(s.amount, s.currency)} ${billingLabel(s.interval, s.intervalCount)}`,
            statusLabel(s.status),
            s.nextChargeAt ? `Next charge ${relativeTime(s.nextChargeAt)}` : 'No next charge',
          ],
        })}
      />

      <Section
        title="Transactions"
        empty="Money this customer sends you will show here."
        query={transactions}
        row={(tx) => ({
          key: tx.id,
          href: `/app/transactions/${tx.id}`,
          cells: [
            formatTokenAmount(tx.amount, tx.currency),
            statusLabel(tx.kind),
            statusLabel(tx.status),
            relativeTime(tx.blockTimestamp),
          ],
        })}
      />

      <Section
        title="Refunds"
        empty="Refunds you send this customer will show here."
        query={refunds}
        row={(r) => ({
          key: r.id,
          href: `/app/transactions/${r.transactionId}`,
          cells: [
            formatTokenAmount(r.amount, r.currency),
            statusLabel(r.status),
            relativeTime(r.createdAt),
          ],
        })}
      />

      <Section
        title="Invoices"
        empty="Invoices this customer pays will show here."
        query={invoices}
        row={(inv) => ({
          key: inv.id,
          href: `/app/invoices/${inv.id}`,
          cells: [
            inv.number,
            formatTokenAmount(inv.total, inv.currency),
            statusLabel(inv.status),
            `Due ${new Date(inv.dueAt).toLocaleDateString()}`,
          ],
        })}
      />
    </div>
  )
}

interface SectionQuery<T> {
  data?: { data: T[] }
  isPending: boolean
  isError: boolean
  refetch: () => unknown
}

function Section<T>({
  title,
  empty,
  query,
  row,
}: {
  title: string
  empty: string
  query: SectionQuery<T>
  row: (item: T) => { key: string; href: string; cells: string[] }
}) {
  const items = query.data?.data ?? []
  return (
    <Card>
      <CardContent className="space-y-3 p-6 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">{title}</h2>
          {items.length >= SECTION_LIMIT ? (
            <span className="text-muted-foreground text-xs">
              Showing the latest {SECTION_LIMIT}
            </span>
          ) : null}
        </div>
        {query.isPending ? (
          <p className="text-muted-foreground text-xs">Loading…</p>
        ) : query.isError ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Couldn’t load {title.toLowerCase()}.
            </p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-xs">{empty}</p>
        ) : (
          <ul className="divide-border divide-y">
            {items.map((item) => {
              const r = row(item)
              return (
                <li key={r.key}>
                  <Link
                    href={r.href}
                    className="hover:bg-muted/40 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md p-2 text-xs sm:flex sm:items-center sm:justify-between"
                  >
                    {r.cells.map((cell, i) => (
                      <span
                        key={i}
                        className={i === 0 ? 'font-medium tabular-nums' : 'text-muted-foreground'}
                      >
                        {cell}
                      </span>
                    ))}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function statusLabel(value: string) {
  const text = value.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/customers">
        <ArrowLeft className="mr-1.5 size-4" /> Back to customers
      </Link>
    </Button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {children}
    </div>
  )
}

function CopyValue({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="hover:text-accent inline-flex min-w-0 items-center gap-1 break-all text-right text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => toast.success('Copied'))
      }}
    >
      {value}
      <Copy className="size-3 shrink-0" />
    </button>
  )
}
