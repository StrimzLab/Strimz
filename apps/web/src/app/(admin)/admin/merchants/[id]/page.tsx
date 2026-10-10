'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Ban, RotateCcw } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import type { Mode } from '@strimz/shared-types'
import { SegmentedToggle } from '@/components/shared/segmented-toggle'
import { relativeTime, shortAddress } from '@/lib/format'
import { formatCurrencyAmounts } from '@/lib/currency-totals'
import { MODE_OPTIONS } from '@/lib/admin-volume'
import type { MerchantTier } from '@/lib/admin-api'
import { suspendMerchantConfirm } from '@/lib/destructive-actions'
import {
  ConfirmActionDialog,
  type PendingConfirm,
} from '@/components/dashboard/confirm-action-dialog'
import {
  useAdminMerchantDetail,
  useReactivateMerchant,
  useSetMerchantTier,
  useSuspendMerchant,
} from '@/hooks/admin'

const TIERS: MerchantTier[] = ['free', 'growth', 'business', 'enterprise']

export default function AdminMerchantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [mode, setMode] = React.useState<Mode>('live')
  const { data: merchant, isLoading, isError, error, refetch } = useAdminMerchantDetail(id, mode)

  const suspendMutation = useSuspendMerchant()
  const reactivateMutation = useReactivateMerchant()
  const tierMutation = useSetMerchantTier()
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirm | null>(null)

  if (isLoading) {
    return <div className="bg-muted/30 mt-6 h-32 animate-pulse rounded-xl" />
  }
  if (isError || !merchant) {
    return (
      <Card className="border-border/60 mt-6">
        <CardContent className="flex items-center justify-between p-4">
          <div className="text-xs">
            <div className="font-medium">Couldn’t load merchant</div>
            <div className="text-muted-foreground">{error?.message ?? 'unknown error'}</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isSuspended = merchant.status === 'suspended'
  const isClosed = merchant.status === 'closed'

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/admin/merchants">
            <ArrowLeft className="mr-1 size-3" /> All merchants
          </Link>
        </Button>
        <PageHeader
          title={merchant.businessName ?? merchant.email}
          description={merchant.email}
          action={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {merchant.status}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {merchant.tier}
              </Badge>
            </div>
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          Figures below are for {merchant.stats.mode} mode.
        </span>
        <SegmentedToggle label="Mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Lifetime volume"
          value={formatCurrencyAmounts(merchant.stats.lifetimeVolume)}
        />
        <Stat label="30-day volume" value={formatCurrencyAmounts(merchant.stats.last30dVolume)} />
        <Stat
          label="Confirmed payments"
          value={merchant.stats.confirmedPayments.toLocaleString()}
        />
        <Stat
          label="Active subscriptions"
          value={merchant.stats.activeSubscriptions.toLocaleString()}
        />
      </div>

      <Card className="border-border/60">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Merchant ID">
            <code className="text-xs">{merchant.id}</code>
          </Field>
          <Field label="On-chain merchant ID">
            <code className="text-xs">
              {merchant.onchainMerchantId !== null ? merchant.onchainMerchantId : '—'}
            </code>
          </Field>
          <Field label="Payout address">
            <code className="text-xs">
              {merchant.payoutAddress ? shortAddress(merchant.payoutAddress) : '—'}
            </code>
          </Field>
          <Field label="Country">
            <span className="text-sm">{merchant.countryCode ?? '—'}</span>
          </Field>
          <Field label="Website">
            {merchant.websiteUrl ? (
              <a
                href={merchant.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-accent text-xs hover:underline"
              >
                {merchant.websiteUrl}
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Field>
          <Field label="Default currency">
            <span className="text-sm">{merchant.defaultCurrency}</span>
          </Field>
          <Field label="Joined">
            <span className="text-muted-foreground text-sm">
              {relativeTime(merchant.createdAt)}
            </span>
          </Field>
          <Field label="Last login">
            <span className="text-muted-foreground text-sm">
              {merchant.lastLoginAt ? relativeTime(merchant.lastLoginAt) : 'never'}
            </span>
          </Field>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="font-sora text-base font-semibold">Admin actions</h3>
            <p className="text-muted-foreground text-xs">
              These run through `/api/admin/*` BFF routes. Audited server-side, gated on the admin
              role.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border/60 rounded-md border p-3">
              <div className="text-sm font-medium">Status</div>
              <p className="text-muted-foreground mt-1 text-xs">
                Suspended merchants can’t take new payments. Closed is permanent.
              </p>
              <div className="mt-3 flex gap-2">
                {isSuspended || isClosed ? (
                  <Button
                    size="sm"
                    onClick={() => reactivateMutation.mutate(merchant.id)}
                    disabled={reactivateMutation.isPending || isClosed}
                  >
                    <RotateCcw className="mr-1.5 size-3" /> Reactivate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
                    onClick={() =>
                      setPendingConfirm({
                        copy: suspendMerchantConfirm({
                          businessName: merchant.businessName ?? merchant.email,
                        }),
                        run: () => suspendMutation.mutate(merchant.id),
                      })
                    }
                    disabled={suspendMutation.isPending}
                  >
                    <Ban className="mr-1.5 size-3" /> Suspend
                  </Button>
                )}
              </div>
            </div>

            <div className="border-border/60 rounded-md border p-3">
              <div className="text-sm font-medium">Tier</div>
              <p className="text-muted-foreground mt-1 text-xs">
                The tier must match the fee the on-chain registry charges this merchant. Free,
                Growth and Business need their exact fee; Enterprise accepts any fee. To change the
                fee, an operator sends setFeeBps with the registry admin key, waits for the receipt,
                then sets the tier here. An unregistered merchant can only be set to Free. A
                mismatch is refused with the fee the registry needs.
              </p>
              <div className="mt-3">
                <Select
                  value={merchant.tier}
                  onValueChange={(v) =>
                    tierMutation.mutate({ id: merchant.id, input: { tier: v as MerchantTier } })
                  }
                  disabled={tierMutation.isPending}
                >
                  <SelectTrigger className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmActionDialog pending={pendingConfirm} onClose={() => setPendingConfirm(null)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-sora mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}
