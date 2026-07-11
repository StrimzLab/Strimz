'use client'

import * as React from 'react'
import { ExternalLink, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Badge,
  Card,
  CardContent,
  FieldLabel,
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
import { ImageUpload } from '@/components/dashboard/image-upload'
import { OnchainPolicySection } from '@/components/dashboard/onchain-policy-section'
import { useMerchantMe, useUpdateMerchant } from '@/hooks/api'

/**
 * Settings page.
 *
 * The Business and Payout tabs are the only ones backed by real
 * `UpdateMerchantInput` fields. Everything in Notifications, Team,
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
 *   - The form does NOT subscribe to per-field merchant updates ,
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
          docsSlug="settings"
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
  // diff editor. Only changed fields go to the API.
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
            <FieldLabel htmlFor="biz-name" required>
              Business name
            </FieldLabel>
            <Input
              id="biz-name"
              value={draft.value('businessName') ?? ''}
              onChange={(e) => draft.set('businessName', e.target.value)}
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="biz-country" required={false}>
              Country (ISO-2)
            </FieldLabel>
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
            <FieldLabel htmlFor="biz-web" required={false}>
              Website
            </FieldLabel>
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
            <FieldLabel htmlFor="biz-logo" required={false}>
              Logo
            </FieldLabel>
            <ImageUpload
              endpoint="merchantLogo"
              value={(draft.value('logoUrl') as string | null | undefined) ?? null}
              onChange={(url) => draft.set('logoUrl', url)}
              aspect="square"
              maxSizeLabel="up to 2MB"
              alt={(draft.value('businessName') as string | undefined) ?? 'Merchant logo'}
              className="w-40"
            />
            <p className="text-muted-foreground text-xs">
              Shown to your payers on every checkout page. Skip and your customers see a
              wallet-derived placeholder.
            </p>
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
        description="Two-factor authentication is enforced by Privy. Strimz never sees or stores the secret."
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
        title="Payout settings"
        description="Your payout wallet is your Strimz-embedded wallet by default. To route payouts elsewhere, use the On-chain policy panel below — that path enforces a 24-hour safety delay."
      >
        <div className="grid gap-1.5">
          <Label>Current payout wallet</Label>
          <div className="border-border/60 bg-muted/30 rounded-md border px-3 py-2 font-mono text-xs">
            {merchant.payoutAddress ?? '0x…'}
          </div>
        </div>
        <div className="grid gap-1.5">
          <FieldLabel htmlFor="payout-currency" required>
            Settlement currency
          </FieldLabel>
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

      <OnchainPolicySection />
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
  const { data: merchant } = useMerchantMe()
  const updateMutation = useUpdateMerchant()

  const prefsRaw = (merchant?.metadata as Record<string, unknown> | undefined)?.emailPrefs as
    | Partial<{ paymentReceived: boolean; subscriptionCharged: boolean }>
    | undefined
  const paymentReceived = prefsRaw?.paymentReceived ?? true
  const subscriptionCharged = prefsRaw?.subscriptionCharged ?? true

  const toggle = (key: 'paymentReceived' | 'subscriptionCharged', value: boolean) => {
    updateMutation.mutate({ emailPrefs: { [key]: value } })
  }

  return (
    <SettingsCard
      title="Email notifications"
      description="You control which events email you. Payer receipts (the ones your customers get) always send and are not affected here."
    >
      <ToggleRow
        id="notif-payment"
        label="Payment received"
        desc="One per confirmed PaymentSession. Sent to your merchant inbox."
        checked={paymentReceived}
        onCheckedChange={(v) => toggle('paymentReceived', v)}
      />
      <ToggleRow
        id="notif-sub-charged"
        label="Recurring charge succeeded"
        desc="One per succeeded SubscriptionCharge. Off is quieter if you have many active subs."
        checked={subscriptionCharged}
        onCheckedChange={(v) => toggle('subscriptionCharged', v)}
      />
      <div className="text-muted-foreground border-border/60 border-t pt-3 text-xs">
        Refund receipts and welcome emails always send. Gas-balance alerts go to Strimz ops, not
        you.
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
          onClick={() => toast.error('Account deletion is API-only. Contact support.')}
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
  checked,
  onCheckedChange,
  readOnly,
}: {
  id: string
  label: string
  desc: string
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (v: boolean) => void
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
      <Switch
        id={id}
        defaultChecked={defaultChecked}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={readOnly}
      />
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
