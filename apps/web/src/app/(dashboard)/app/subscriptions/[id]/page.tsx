'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ban, Loader2 } from 'lucide-react'
import { Button, Card, CardContent } from '@strimz/ui'
import type { SubscriptionStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { StatusPill } from '@/components/dashboard/data-table'
import {
  ConfirmActionDialog,
  type PendingConfirm,
} from '@/components/dashboard/confirm-action-dialog'
import { cancelSubscriptionConfirm } from '@/lib/destructive-actions'
import { formatTokenAmount, relativeTime } from '@/lib/format'
import { billingLabel } from '@/lib/plans-view'
import {
  useCancelSubscription,
  useSubscription,
  useSubscriptionPlan,
  useTransactions,
} from '@/hooks/api'

const STATUS_TONE: Record<
  SubscriptionStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  active: 'positive',
  trialing: 'info',
  at_risk: 'warning',
  paused: 'neutral',
  cancelled: 'neutral',
  lapsed: 'danger',
}

const CANCELLABLE: ReadonlySet<SubscriptionStatus> = new Set(['active', 'trialing', 'at_risk'])

export default function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: sub, isPending, isError } = useSubscription(id)
  const planQuery = useSubscriptionPlan(sub?.planId)
  const chargesQuery = useTransactions({ subscriptionId: id, limit: 25 })
  const cancelMutation = useCancelSubscription()
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirm | null>(null)

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-accent size-6 animate-spin" />
      </div>
    )
  }
  if (isError || !sub) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">Subscription not found.</CardContent>
        </Card>
      </div>
    )
  }

  const charges = chargesQuery.data?.data ?? []
  const planName = planQuery.data?.name

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={`${formatTokenAmount(sub.amount, sub.currency)} ${billingLabel(sub.interval, sub.intervalCount)}`}
        description={`Subscribed ${relativeTime(sub.createdAt)}.`}
        badge={
          <StatusPill tone={STATUS_TONE[sub.status]}>{sub.status.replace(/_/g, ' ')}</StatusPill>
        }
        action={
          !CANCELLABLE.has(sub.status) ? null : (
            <Button
              variant="outline"
              size="sm"
              disabled={cancelMutation.isPending}
              onClick={() =>
                setPendingConfirm({
                  copy: cancelSubscriptionConfirm(sub),
                  run: () => cancelMutation.mutate({ id: sub.id }),
                })
              }
            >
              <Ban className="mr-1.5 size-4" /> Cancel
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <Row label="Plan">
            <Link href={`/app/plans/${sub.planId}`} className="text-accent hover:underline">
              {planName ?? `${sub.planId.slice(0, 14)}…`}
            </Link>
          </Row>
          <Row label="Payer">
            <span className="font-mono text-xs">{sub.payerAddress}</span>
          </Row>
          {sub.trialEndsAt ? (
            <Row label="Trial ends">
              <span>{relativeTime(sub.trialEndsAt)}</span>
            </Row>
          ) : null}
          <Row label="Current period">
            <span>
              {new Date(sub.currentPeriodStartAt).toLocaleDateString()} –{' '}
              {new Date(sub.currentPeriodEndAt).toLocaleDateString()}
            </span>
          </Row>
          <Row label="Next charge">
            <span>{sub.nextChargeAt ? relativeTime(sub.nextChargeAt) : 'None'}</span>
          </Row>
          {sub.cancelledAt ? (
            <Row label="Cancelled">
              <span>{relativeTime(sub.cancelledAt)}</span>
            </Row>
          ) : null}
          <Row label="Subscription ID">
            <span className="font-mono text-xs">{sub.id}</span>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <div className="font-medium">Charges</div>
          {chargesQuery.isPending ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : chargesQuery.isError ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-rose-600">Couldn’t load charges.</p>
              <Button variant="outline" size="sm" onClick={() => chargesQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : charges.length === 0 ? (
            <p className="text-muted-foreground text-xs">No charges yet.</p>
          ) : (
            charges.map((tx) => (
              <Link
                key={tx.id}
                href={`/app/transactions/${tx.id}`}
                className="hover:bg-muted/40 flex items-center justify-between rounded-md p-2 text-xs"
              >
                <span className="font-mono">{formatTokenAmount(tx.amount, tx.currency)}</span>
                <span>{tx.status}</span>
                <span className="text-muted-foreground">{relativeTime(tx.blockTimestamp)}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog pending={pendingConfirm} onClose={() => setPendingConfirm(null)} />
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/subscriptions">
        <ArrowLeft className="mr-1.5 size-4" /> Back to subscriptions
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
