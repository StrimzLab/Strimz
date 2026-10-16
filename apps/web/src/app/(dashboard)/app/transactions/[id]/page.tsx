'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, ExternalLink, Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardContent } from '@strimz/ui'
import { getArcExplorerUrl } from '@strimz/shared-config'
import type { TransactionStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { NewRefundDialog } from '@/components/dashboard/refunds/new-refund-dialog'
import { useRefundSigner } from '@/components/dashboard/refunds/use-refund-signer'
import { env } from '@/lib/env'
import { formatTokenAmount, relativeTime } from '@/lib/format'
import { canRefund, transactionKindLabel } from '@/lib/transactions-view'
import { useTransaction } from '@/hooks/api'

const STATUS_TONE: Record<TransactionStatus, 'positive' | 'warning' | 'danger'> = {
  confirmed: 'positive',
  pending: 'warning',
  failed: 'danger',
}

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: tx, isPending, isError } = useTransaction(id)
  const { sign } = useRefundSigner()

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-accent size-6 animate-spin" />
      </div>
    )
  }
  if (isError || !tx) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">Transaction not found.</CardContent>
        </Card>
      </div>
    )
  }

  const explorer = getArcExplorerUrl(env.arcEnvironment)

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={`${transactionKindLabel(tx.kind)} · ${formatTokenAmount(tx.amount, tx.currency)}`}
        description={`Confirmed on-chain ${relativeTime(tx.blockTimestamp)}.`}
        badge={<StatusPill tone={STATUS_TONE[tx.status]}>{tx.status}</StatusPill>}
        action={
          canRefund(tx) ? (
            <NewRefundDialog
              onSignRequested={sign}
              transaction={tx}
              trigger={
                <Button size="sm">
                  <Undo2 className="mr-1.5 size-4" /> Refund
                </Button>
              }
            />
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-6 text-sm">
            <Row label="Amount">
              <span className="inline-flex items-center gap-1.5 font-mono">
                <TokenLogo symbol={tx.currency} size={14} />
                {formatTokenAmount(tx.amount, tx.currency)}
              </span>
            </Row>
            <Row label="Strimz fee">
              <span className="font-mono">{formatTokenAmount(tx.feeAmount, tx.currency)}</span>
            </Row>
            <Row label="Net to you">
              <span className="font-mono">{formatTokenAmount(tx.netAmount, tx.currency)}</span>
            </Row>
            <Row label="Payer">
              <CopyValue value={tx.payerAddress} />
            </Row>
            <Row label="Paid to">
              <CopyValue value={tx.merchantAddress} />
            </Row>
            <Row label="Block">
              <span className="font-mono">{tx.blockNumber}</span>
            </Row>
            <Row label="Transaction ID">
              <CopyValue value={tx.id} />
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <div className="font-medium">On-chain</div>
            <a
              href={`${explorer}/tx/${tx.onchainTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent inline-flex items-center gap-1 font-mono text-xs hover:underline"
            >
              {tx.onchainTxHash.slice(0, 18)}… <ExternalLink className="size-3" />
            </a>
            <div className="font-medium">Linked to</div>
            {tx.sessionId ? (
              <Row label="Payment session">
                <CopyValue value={tx.sessionId} />
              </Row>
            ) : null}
            {tx.subscriptionId ? (
              <Row label="Subscription">
                <CopyValue value={tx.subscriptionId} />
              </Row>
            ) : null}
            {tx.refundId ? (
              <Row label="Refund">
                <Link href="/app/refunds" className="text-accent hover:underline">
                  View refunds
                </Link>
              </Row>
            ) : null}
            {tx.customerId ? (
              <Row label="Customer">
                <CopyValue value={tx.customerId} />
              </Row>
            ) : null}
            {!tx.sessionId && !tx.subscriptionId && !tx.refundId && !tx.customerId ? (
              <p className="text-muted-foreground text-xs">
                Not linked to a session or subscription.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/transactions">
        <ArrowLeft className="mr-1.5 size-4" /> Back to transactions
      </Link>
    </Button>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function CopyValue({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="hover:text-accent inline-flex items-center gap-1 font-mono text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => toast.success('Copied'))
      }}
    >
      {value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value}
      <Copy className="size-3" />
    </button>
  )
}
