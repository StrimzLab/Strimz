'use client'

import * as React from 'react'
import { ExternalLink, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Badge,
  Card,
  CardContent,
  Input,
  Label,
  Switch,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'
import type { Merchant, PaymentCurrency, UpdateMerchantInput } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { useMerchantMe, useUpdateMerchant } from '@/hooks/api'

/**
 * Settings page.
 *
 * The Business and Payout tabs are the only ones backed by real
 * `UpdateMerchantInput` fields — everything in Notifications, Team,
 * and Billing is either auth-managed by Privy or scheduled for a
 * later API milestone. Those tabs stay rendered as static UI so the
 * IA doesn't shift under the merchant's feet, but their controls
 * are clearly aspirational.
 *
 * Form state:
 *   - We hold a local `draft` copy of the merchant so the inputs are
 *     controlled and we can compute "is dirty?" before allowing save.
 *   - The merchant query owns the source of truth; on save, the
 *     mutation patches it and the next render re-reads from cache.
 *   - The form does NOT subscribe to per-field merchant updates —
 *     the `useMerchantMe` hook reads once on mount + on the explicit
 *     mutation invalidation.
 */
export default function SettingsPage() {
  const { data: merchant, isLoading } = useMerchantMe()

  if (isLoading || !merchant) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Account, business, payout, notifications, and team."
        />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-border/60 bg-muted/30 h-24 animate-pulse rounded-xl border"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Account, business, payout, notifications, and team."
      />

      <Tabs defaultValue="business">
        <TabsList>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="payout">Payout</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="business" className="mt-4 space-y-4">
          <BusinessSection merchant={merchant} />
        </TabsContent>

        <TabsContent value="payout" className="mt-4 space-y-4">
          <PayoutSection merchant={merchant} />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 space-y-4">
          <NotificationsSection />
        </TabsContent>

        <TabsContent value="team" className="mt-4 space-y-4">
          <TeamSection />
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-4">
          <BillingSection merchant={merchant} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Hook that owns a draft of a partial merchant record. Returns a
 * dispatcher tuple plus `isDirty` and a `reset` so the form can wipe
 * back to the latest server snapshot after a successful save.
 */
function useMerchantDraft(merchant: Merchant) {
  const [draft, setDraft] = React.useState<UpdateMerchantInput>({})

  // Reset draft when the merchant identity changes (mutation succeeded,
  // server snapshot now has fresh values). Keyed on `updatedAt` so
  // unrelated re-renders don't clear in-progress edits.
  React.useEffect(() => {
    setDraft({})
  }, [merchant.updatedAt])

  const set = React.useCallback(
    <K extends keyof UpdateMerchantInput>(key: K, value: UpdateMerchantInput[K]) => {
      setDraft((d) => ({ ...d, [key]: value }))
    },
    [],
  )

  const isDirty = Object.keys(draft).length > 0

  // Value-or-merchant: form inputs read from draft if present, else
  // fall back to the persisted merchant. Lets the form behave like a
  // diff editor — only changed fields go to the API.
  const value = React.useCallback(
    <K extends keyof UpdateMerchantInput>(key: K): UpdateMerchantInput[K] | undefined => {
      if (key in draft) return draft[key]
      const merchantValue = (merchant as unknown as Record<string, unknown>)[key as string]
      return merchantValue as UpdateMerchantInput[K] | undefined
    },
    [draft, merchant],
  )

  return { draft, set, value, isDirty, reset: () => setDraft({}) }
}

function BusinessSection({ merchant }: { merchant: Merchant }) {
  const draft = useMerchantDraft(merchant)
  const updateMutation = useUpdateMerchant()

  const onSave = () => {
    if (!draft.isDirty) return
    updateMutation.mutate(draft.draft, {
      onSuccess: () => draft.reset(),
    })
  }

  return (
    <>
      <SettingsCard
        title="Business"
        description="We use these on invoices, payout receipts, and your business verification."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="biz-name">Business name</Label>
            <Input
              id="biz-name"
              value={draft.value('businessName') ?? ''}
              onChange={(e) => draft.set('businessName', e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="biz-country">Country (ISO-2)</Label>
            <Input
              id="biz-country"
              maxLength={2}
              value={(draft.value('countryCode') as string | null | undefined) ?? ''}
              onChange={(e) => draft.set('countryCode', e.target.value.toUpperCase() || null)}
              className="h-9 uppercase"
              placeholder="GB"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="biz-web">Website</Label>
            <Input
              id="biz-web"
              type="url"
              value={(draft.value('websiteUrl') as string | null | undefined) ?? ''}
              onChange={(e) => draft.set('websiteUrl', e.target.value || null)}
              className="h-9"
              placeholder="https://strimz.finance"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="biz-logo">Logo URL</Label>
            <Input
              id="biz-logo"
              type="url"
              value={(draft.value('logoUrl') as string | null | undefined) ?? ''}
              onChange={(e) => draft.set('logoUrl', e.target.value || null)}
              className="h-9"
              placeholder="https://…/logo.png"
            />
          </div>
        </div>
        <SaveBar
          isDirty={draft.isDirty}
          isPending={updateMutation.isPending}
          onSave={onSave}
          onReset={draft.reset}
        />
      </SettingsCard>

      <SettingsCard
        title="Security"
        description="Two-factor authentication is enforced by Privy — Strimz never sees or stores the secret."
      >
        <div className="border-border/60 flex items-center justify-between rounded-md border p-3">
          <div className="text-sm">
            <div className="font-medium">2FA</div>
            <div className="text-muted-foreground text-xs">
              Managed by Privy. Required to issue or rotate live-mode keys.
            </div>
          </div>
          <Badge variant="outline" className="border-[#02C76A]/40 bg-[#02C76A]/10 text-[#02C76A]">
            Managed by Privy
          </Badge>
        </div>
        <Button variant="outline" asChild>
          <a href="https://privy.io" target="_blank" rel="noreferrer">
            Manage 2FA in Privy <ExternalLink className="ml-1.5 size-3.5" />
          </a>
        </Button>
      </SettingsCard>
    </>
  )
}

function PayoutSection({ merchant }: { merchant: Merchant }) {
  const draft = useMerchantDraft(merchant)
  const updateMutation = useUpdateMerchant()

  const onSave = () => {
    if (!draft.isDirty) return
    updateMutation.mutate(draft.draft, {
      onSuccess: () => draft.reset(),
    })
  }

  return (
    <>
      <SettingsCard
        title="Payout wallet"
        description="USDC lands in this wallet whenever a customer pays you."
      >
        <div className="grid gap-1.5">
          <Label htmlFor="payout-wallet">Payout wallet (Arc)</Label>
          <Input
            id="payout-wallet"
            value={(draft.value('payoutAddress') as string | undefined) ?? ''}
            onChange={(e) => draft.set('payoutAddress', e.target.value as `0x${string}`)}
            className="h-9 font-mono"
            placeholder="0x…"
          />
          <p className="text-muted-foreground text-xs">
            We validate the format on save. Changes apply immediately to new sessions.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="payout-currency">Settlement currency</Label>
          <Select
            value={draft.value('defaultCurrency') ?? merchant.defaultCurrency}
            onValueChange={(v) => draft.set('defaultCurrency', v as PaymentCurrency)}
          >
            <SelectTrigger id="payout-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USDC">USDC</SelectItem>
              <SelectItem value="EURC">EURC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SaveBar
          isDirty={draft.isDirty}
          isPending={updateMutation.isPending}
          onSave={onSave}
          onReset={draft.reset}
        />
      </SettingsCard>

      <SettingsCard
        title="Fees"
        description="A fee is taken on each transaction, in the same payment. There's no separate invoice."
      >
        <div className="border-border/60 rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Current tier</span>
            <Badge className="capitalize">{merchant.tier}</Badge>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Tier upgrades happen automatically based on rolling 30-day volume.
          </p>
        </div>
      </SettingsCard>
    </>
  )
}

/**
 * Notifications, team, and billing sections render against fields
 * that aren't yet patchable via `UpdateMerchantInput`. The toggles
 * and form controls are wired locally so the IA feels right, but
 * `Save` currently surfaces a placeholder toast rather than hitting
 * a non-existent endpoint. Replace when the matching API ships.
 */
function NotificationsSection() {
  return (
    <SettingsCard
      title="Email notifications"
      description="Pick what shows up in your inbox. (Backed by the merchant-notifications cron — see scheduler README.)"
    >
      <ToggleRow
        id="notif-payment"
        label="Payment received"
        desc="One per confirmed PaymentSession."
        defaultChecked
        readOnly
      />
      <ToggleRow
        id="notif-sub-started"
        label="New subscriber"
        desc="One per Subscription row."
        defaultChecked
        readOnly
      />
      <ToggleRow
        id="notif-sub-charged"
        label="Recurring charge succeeded"
        desc="One per succeeded SubscriptionCharge."
        defaultChecked
        readOnly
      />
      <ToggleRow
        id="notif-failed"
        label="Subscription charge failed"
        desc="One per failed charge attempt."
      />
      <ToggleRow
        id="notif-webhook"
        label="Webhook endpoint disabled"
        desc="Auto-fires after 5+ permanent failures."
      />
      <div className="text-muted-foreground border-border/60 border-t pt-3 text-xs">
        Notification preferences ship in the next iteration — for now every event above is sent.
      </div>
    </SettingsCard>
  )
}

function TeamSection() {
  return (
    <SettingsCard title="Team" description="Invite teammates with scoped roles.">
      <div className="text-muted-foreground border-border/60 rounded-md border border-dashed p-4 text-xs">
        Team management UI ships in the next iteration. Use the API directly via{' '}
        <code className="bg-muted rounded px-1 py-0.5">POST /v1/merchants/me/members</code>.
      </div>
    </SettingsCard>
  )
}

function BillingSection({ merchant }: { merchant: Merchant }) {
  return (
    <>
      <SettingsCard
        title="Plan"
        description="Fees are taken on each transaction. There's no monthly bill to pay."
      >
        <div className="border-border/60 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium capitalize">{merchant.tier}</div>
              <div className="text-muted-foreground text-xs">
                {merchant.tier === 'free' ? '0.5% per transaction' : 'Negotiated rate'}
              </div>
            </div>
            <Badge variant="outline" className="border-[#02C76A]/40 bg-[#02C76A]/10 text-[#02C76A]">
              Current
            </Badge>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Danger zone"
        description="Deleting your account is permanent. Your live data, keys, and webhook endpoints will all be removed."
      >
        <Textarea rows={2} placeholder="Type DELETE to confirm" className="resize-none" />
        <Button
          variant="outline"
          className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10"
          onClick={() => toast.error('Account deletion is API-only — contact support.')}
        >
          Delete account
        </Button>
      </SettingsCard>
    </>
  )
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card className="shadow-sub-card border-border/60">
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="font-sora text-base font-semibold">{title}</h3>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          ) : null}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function ToggleRow({
  id,
  label,
  desc,
  defaultChecked,
  readOnly,
}: {
  id: string
  label: string
  desc: string
  defaultChecked?: boolean
  readOnly?: boolean
}) {
  return (
    <div className="border-border/60 flex items-center justify-between rounded-md border p-3">
      <div className="text-sm">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        <div className="text-muted-foreground text-xs">{desc}</div>
      </div>
      <Switch id={id} defaultChecked={defaultChecked} disabled={readOnly} />
    </div>
  )
}

function SaveBar({
  isDirty,
  isPending,
  onSave,
  onReset,
}: {
  isDirty: boolean
  isPending: boolean
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      {isDirty ? (
        <Button variant="ghost" onClick={onReset} disabled={isPending}>
          Discard
        </Button>
      ) : null}
      <Button onClick={onSave} disabled={!isDirty || isPending}>
        <Save className="mr-1.5 size-4" /> {isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}
