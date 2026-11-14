'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ban, Copy, ExternalLink, Loader2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardContent } from '@strimz/ui'
import { getArcExplorerUrl } from '@strimz/shared-config'
import type { PaymentSessionStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { NewRefundDialog } from '@/components/dashboard/refunds/new-refund-dialog'
import { useRefundSigner } from '@/components/dashboard/refunds/use-refund-signer'
import {
  ConfirmActionDialog,
  type PendingConfirm,
} from '@/components/dashboard/confirm-action-dialog'
import { env } from '@/lib/env'
import { cancelPaymentSessionConfirm } from '@/lib/destructive-actions'
import { formatTokenAmount, relativeTime } from '@/lib/format'
import { canRefund, transactionKindLabel } from '@/lib/transactions-view'
import { useCancelPaymentSession, usePaymentSession, useTransactions } from '@/hooks/api'

const STATUS_TONE: Record<
  PaymentSessionStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  confirmed: 'positive',
  created: 'info',
  awaiting_payment: 'info',
  submitted: 'info',
  failed: 'danger',
  expired: 'warning',
  cancelled: 'neutral',
}

const OPEN_STATUSES: ReadonlySet<PaymentSessionStatus> = new Set(['created', 'awaiting_payment'])

export default function PaymentSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, isPending, isError } = usePaymentSession(id)
  const transactionsQuery = useTransactions({ sessionId: id, limit: 10 })
  const cancelMutation = useCancelPaymentSession()
  const { sign } = useRefundSigner()
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirm | null>(null)

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-accent size-6 animate-spin" />
      </div>
    )
  }
  if (isError || !session) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">
            Payment session not found.
          </CardContent>
        </Card>
      </div>
    )
  }

  const explorer = getArcExplorerUrl(env.arcEnvironment)
  const payments = transactionsQuery.data?.data ?? []
  const refundable = payments.find(canRefund) ?? null

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={`${formatTokenAmount(session.amount, session.currency)}${session.description ? ` · ${session.description}` : ''}`}
        description={`Created ${relativeTime(session.createdAt)}.`}
        badge={
          <StatusPill tone={STATUS_TONE[session.status]}>
            {session.status.replace(/_/g, ' ')}
          </StatusPill>
        }
        action={
          <div className="flex items-center gap-2">
            {OPEN_STATUSES.has(session.status) ? (
              <Button
                variant="outline"
                size="sm"
                disabled={cancelMutation.isPending}
                onClick={() =>
                  setPendingConfirm({
                    copy: cancelPaymentSessionConfirm(session),
                    run: () => cancelMutation.mutate(session.id),
                  })
                }
              >
                <Ban className="mr-1.5 size-4" /> Cancel
              </Button>
            ) : null}
            {refundable ? (
              <NewRefundDialog
                onSignRequested={sign}
                transaction={refundable}
                trigger={
                  <Button size="sm">
                    <Undo2 className="mr-1.5 size-4" /> Refund
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-6 text-sm">
            <Row label="Amount">
              <span className="inline-flex items-center gap-1.5 font-mono">
                <TokenLogo symbol={session.currency} size={14} />
                {formatTokenAmount(session.amount, session.currency)}
              </span>
            </Row>
            <Row label="Strimz fee">
              <span className="font-mono">
                {formatTokenAmount(session.feeAmount, session.currency)}
              </span>
            </Row>
            <Row label="Net to you">
              <span className="font-mono">
                {formatTokenAmount(session.netAmount, session.currency)}
              </span>
            </Row>
            <Row label={OPEN_STATUSES.has(session.status) ? 'Expires' : 'Expiry'}>
              <span>{relativeTime(session.expiresAt)}</span>
            </Row>
            <Row label="Payer">
              {session.payerWalletAddress ? (
                <CopyValue value={session.payerWalletAddress} />
              ) : (
                <span className="text-muted-foreground">Not paid yet</span>
              )}
            </Row>
            {session.payerEmail ? (
              <Row label="Payer email">
                <span>{session.payerEmail}</span>
              </Row>
            ) : null}
            <Row label="Session ID">
              <CopyValue value={session.id} />
            </Row>
            {session.successUrl ? (
              <Row label="Success URL">
                <span className="truncate text-xs">{session.successUrl}</span>
              </Row>
            ) : null}
            {session.cancelUrl ? (
              <Row label="Cancel URL">
                <span className="truncate text-xs">{session.cancelUrl}</span>
              </Row>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-6 text-sm">
              <div className="font-medium">Payment link</div>
              <div className="border-border/60 bg-muted/30 flex items-center gap-2 rounded-md border p-2">
                <code className="min-w-0 flex-1 truncate text-xs">{session.checkoutUrl}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(session.checkoutUrl)
                      .then(() => toast.success('Payment link copied'))
                  }}
                >
                  <Copy className="size-3" />
                </Button>
              </div>
              {session.onchainTxHash ? (
                <a
                  href={`${explorer}/tx/${session.onchainTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent inline-flex items-center gap-1 font-mono text-xs hover:underline"
                >
                  {session.onchainTxHash.slice(0, 18)}… <ExternalLink className="size-3" />
                </a>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6 text-sm">
              <div className="font-medium">Transactions</div>
              {transactionsQuery.isPending ? (
                <p className="text-muted-foreground text-xs">Loading…</p>
              ) : transactionsQuery.isError ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-rose-600">Couldn’t load transactions.</p>
                  <Button variant="outline" size="sm" onClick={() => transactionsQuery.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : payments.length === 0 ? (
                <p className="text-muted-foreground text-xs">No payment yet.</p>
              ) : (
                payments.map((tx) => (
                  <Link
                    key={tx.id}
                    href={`/app/transactions/${tx.id}`}
                    className="hover:bg-muted/40 flex items-center justify-between rounded-md p-2 text-xs"
                  >
                    <span>{transactionKindLabel(tx.kind)}</span>
                    <span className="font-mono">{formatTokenAmount(tx.amount, tx.currency)}</span>
                    <span className="text-muted-foreground">{tx.status}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmActionDialog pending={pendingConfirm} onClose={() => setPendingConfirm(null)} />
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/payment-sessions">
        <ArrowLeft className="mr-1.5 size-4" /> Back to payment sessions
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
