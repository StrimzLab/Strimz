'use client'

import { useState } from 'react'
import { formatUnits } from 'viem'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Badge, Button } from '@strimz/ui'
import { TOKENS } from '@strimz/shared-config'

import type { ManagedSubscription } from '@/lib/manage-subscriptions'

const STATUS: Record<ManagedSubscription['status'], string> = {
  trialing: 'Free trial',
  active: 'Active',
  at_risk: 'Payment due',
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function twoDecimals(value: string): string {
  const [whole, fraction = ''] = value.split('.')
  return `${whole}.${fraction.padEnd(2, '0')}`
}

export function SubscriptionCard({
  sub,
  highlighted,
  cancelling,
  cancelled,
  busy,
  onCancel,
}: {
  sub: ManagedSubscription
  highlighted: boolean
  cancelling: boolean
  cancelled: boolean
  busy: boolean
  onCancel: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const amount = `${twoDecimals(formatUnits(BigInt(sub.amount), TOKENS[sub.currency].decimals))} ${sub.currency}`
  const next = sub.nextChargeAt ? dateFormat.format(new Date(sub.nextChargeAt)) : null

  return (
    <li
      id={`subscription-${sub.subscriptionId}`}
      className={`bg-card rounded-xl border p-4 shadow-sm ${
        highlighted ? 'border-primary' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground break-words text-xs">
            {sub.merchantName ?? 'Merchant'}
          </p>
          <p className="font-poppins text-foreground break-words font-semibold">{sub.planName}</p>
          <p className="text-foreground mt-1 text-sm font-medium tabular-nums">{amount}</p>
          {next && !cancelled && (
            <p className="text-muted-foreground text-xs">Next charge {next}</p>
          )}
        </div>
        <Badge variant="outline" className="shrink-0">
          {cancelled ? 'Cancelled' : STATUS[sub.status]}
        </Badge>
      </div>

      {cancelled ? (
        <p className="text-foreground mt-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="text-brand-text size-4 shrink-0" />
          Cancelled. You won&apos;t be charged again.
        </p>
      ) : cancelling ? (
        <p className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Cancelling… Confirm in your wallet if it asks.
        </p>
      ) : confirming ? (
        <div className="border-border mt-3 space-y-3 border-t pt-3">
          <p className="text-sm">
            Cancel {sub.planName}? Strimz stops charging this wallet straight away. Access to what
            you paid for is up to {sub.merchantName ?? 'the merchant'}.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-danger"
              onClick={() => {
                setConfirming(false)
                onCancel()
              }}
              disabled={busy}
            >
              Yes, cancel
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirming(true)}
            disabled={busy}
          >
            Cancel subscription
          </Button>
        </div>
      )}
    </li>
  )
}
