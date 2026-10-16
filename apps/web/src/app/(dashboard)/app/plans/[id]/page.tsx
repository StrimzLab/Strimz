'use client'

import * as React from 'react'
import { use } from 'react'
import Link from 'next/link'
import { Archive, ArrowLeft, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardContent } from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { StatusPill } from '@/components/dashboard/data-table'
import {
  ConfirmActionDialog,
  type PendingConfirm,
} from '@/components/dashboard/confirm-action-dialog'
import { archivePlanConfirm } from '@/lib/destructive-actions'
import { formatTokenAmount, relativeTime, shortAddress } from '@/lib/format'
import { billingLabel, planPriceLabel } from '@/lib/plans-view'
import { useArchiveSubscriptionPlan, useSubscriptionPlan, useSubscriptions } from '@/hooks/api'

export default function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: plan, isPending, isError } = useSubscriptionPlan(id)
  const subscriptionsQuery = useSubscriptions({ planId: id, limit: 25 })
  const archiveMutation = useArchiveSubscriptionPlan()
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirm | null>(null)
  const [origin, setOrigin] = React.useState('')

  React.useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  if (isPending) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-accent size-6 animate-spin" />
      </div>
    )
  }
  if (isError || !plan) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="p-6 text-sm text-rose-600">Plan not found.</CardContent>
        </Card>
      </div>
    )
  }

  const signUpUrl = `${origin}/sub/${plan.id}`
  const subscriptions = subscriptionsQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={plan.name}
        description={planPriceLabel(plan)}
        badge={
          <StatusPill tone={plan.status === 'active' ? 'positive' : 'neutral'}>
            {plan.status}
          </StatusPill>
        }
        action={
          plan.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={archiveMutation.isPending}
              onClick={() =>
                setPendingConfirm({
                  copy: archivePlanConfirm(plan),
                  run: () => archiveMutation.mutate(plan.id),
                })
              }
            >
              <Archive className="mr-1.5 size-4" /> Archive
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-6 text-sm">
            <Row label="Price">
              <span className="font-mono">{formatTokenAmount(plan.amount, plan.currency)}</span>
            </Row>
            <Row label="Billed">
              <span>{billingLabel(plan.interval, plan.intervalCount)}</span>
            </Row>
            <Row label="Free trial">
              <span>{plan.trialPeriodDays ? `${plan.trialPeriodDays} days` : 'None'}</span>
            </Row>
            {plan.description ? (
              <Row label="Description">
                <span className="text-right">{plan.description}</span>
              </Row>
            ) : null}
            <Row label="Created">
              <span>{relativeTime(plan.createdAt)}</span>
            </Row>
            <Row label="Plan ID">
              <span className="font-mono text-xs">{plan.id}</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6 text-sm">
            <div className="font-medium">Sign-up link</div>
            {plan.status === 'active' ? (
              <div className="border-border/60 bg-muted/30 flex items-center gap-2 rounded-md border p-2">
                <code className="min-w-0 flex-1 truncate text-xs">{signUpUrl}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(signUpUrl)
                      .then(() => toast.success('Sign-up link copied'))
                  }}
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Archived plans take no new subscribers.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          <div className="font-medium">Subscribers</div>
          {subscriptionsQuery.isPending ? (
            <p className="text-muted-foreground text-xs">Loading…</p>
          ) : subscriptionsQuery.isError ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-rose-600">Couldn’t load subscribers.</p>
              <Button variant="outline" size="sm" onClick={() => subscriptionsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : subscriptions.length === 0 ? (
            <p className="text-muted-foreground text-xs">No subscribers yet.</p>
          ) : (
            subscriptions.map((sub) => (
              <Link
                key={sub.id}
                href={`/app/subscriptions/${sub.id}`}
                className="hover:bg-muted/40 flex items-center justify-between rounded-md p-2 text-xs"
              >
                <span className="font-mono">{shortAddress(sub.payerAddress)}</span>
                <span>{sub.status.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">since {relativeTime(sub.createdAt)}</span>
              </Link>
            ))
          )}
          {subscriptionsQuery.data?.hasMore ? (
            <Link href="/app/subscriptions" className="text-accent text-xs hover:underline">
              See all subscriptions
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmActionDialog pending={pendingConfirm} onClose={() => setPendingConfirm(null)} />
    </div>
  )
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/app/plans">
        <ArrowLeft className="mr-1.5 size-4" /> Back to plans
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
