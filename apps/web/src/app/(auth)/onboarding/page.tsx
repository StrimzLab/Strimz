'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Input, Label } from '@strimz/ui'
import type { OnboardMerchantInput } from '@strimz/shared-types'
import { SubmitButton } from '@/components/auth/submit-button'
import { ImageUpload } from '@/components/dashboard/image-upload'
import { useMerchantMe, useOnboardMerchant } from '@/hooks/api/use-merchant'

const SECTORS = [
  'SaaS',
  'E-commerce',
  'Marketplace',
  'Media & content',
  'Financial services',
  'Other',
] as const

/**
 * Post-signup onboarding form.
 *
 * Lives under the `(auth)` route group so it inherits the same dark
 * two-column shell as `/signup` + `/login` ,  the merchant is still in
 * the "finishing signup" flow, not yet in the dashboard. On submit we
 * stamp `onboardingCompleted: true` server-side and land the merchant
 * on `/app`.
 *
 * We deliberately do NOT force-redirect merchants who've already
 * onboarded: the dashboard's live-mode gate and the sidebar
 * "onboarding banner" both key off `onboardingCompleted`, so hitting
 * `/onboarding` after finishing just resubmits the same info.
 */
export default function OnboardingPage() {
  const router = useRouter()
  const { data: merchant } = useMerchantMe()
  const onboard = useOnboardMerchant()

  const [form, setForm] = useState({
    businessName: '',
    businessSector: SECTORS[0] as (typeof SECTORS)[number],
    countryCode: '',
    websiteUrl: '',
    logoUrl: null as string | null,
    phone: '',
  })

  // If the merchant already finished onboarding, hard-redirect to the
  // dashboard instead of letting them re-submit the wizard.
  useEffect(() => {
    if (merchant?.onboardingCompleted) router.replace('/app')
  }, [merchant?.onboardingCompleted, router])

  // The Privy embedded wallet is the canonical payout at signup. It's
  // also the on-chain Registry owner, so tying payout to it removes a
  // whole class of "who signs Withdraw?" ambiguity. Merchants who need
  // to route payouts elsewhere later use Settings > On-chain policy,
  // which goes through the 24h delay.
  const payoutAddress = merchant?.walletAddress ?? ''

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!payoutAddress) return
    const payload: OnboardMerchantInput = {
      businessName: form.businessName,
      businessSector: form.businessSector,
      countryCode: form.countryCode.toUpperCase(),
      payoutAddress: payoutAddress as `0x${string}`,
      ...(form.websiteUrl ? { websiteUrl: form.websiteUrl } : {}),
      ...(form.logoUrl ? { logoUrl: form.logoUrl } : {}),
      ...(form.phone ? { phone: form.phone } : {}),
    }
    try {
      await onboard.mutateAsync(payload)
      router.push('/app')
    } catch {
      // useMutationWithToast surfaces the error toast.
    }
  }

  const submitting = onboard.isPending

  return (
    <div className="w-full max-w-xl">
      <div className="text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#02C76A]/10 px-3 py-1 text-xs font-medium text-[#02C76A]">
          <Sparkles className="size-3" />
          One step from live
        </span>
        <h1 className="font-sora mt-4 text-3xl font-[700] tracking-tight text-[#050020]">
          Tell us about your business
        </h1>
        <p className="font-poppins text-muted-foreground mt-2 text-sm">
          Powers your dashboard, your storefront, and your live-mode eligibility.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field label="Business name" required>
          <Input
            value={form.businessName}
            onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
            placeholder="Acme Inc."
            required
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Business sector" required>
            <select
              value={form.businessSector}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  businessSector: e.target.value as (typeof SECTORS)[number],
                }))
              }
              className="border-border bg-background h-10 w-full rounded-md border px-3 text-sm"
              required
            >
              {SECTORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Country" required>
            <Input
              value={form.countryCode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  countryCode: e.target.value.toUpperCase().slice(0, 2),
                }))
              }
              maxLength={2}
              placeholder="US"
              required
            />
          </Field>
        </div>

        <Field
          label="Logo (optional)"
          help="Shown to your payers on the checkout page. Skip and your customers see a wallet-derived placeholder — you can upload later from Settings."
        >
          <ImageUpload
            endpoint="merchantLogo"
            value={form.logoUrl}
            onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
            aspect="square"
            maxSizeLabel="up to 2MB"
            alt={form.businessName ? `${form.businessName} logo` : 'Merchant logo'}
            className="w-40"
          />
        </Field>

        <Field label="Website (optional)">
          <Input
            value={form.websiteUrl}
            onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
            placeholder="https://acme.com"
            type="url"
          />
        </Field>

        <Field label="Phone (optional)">
          <Input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+1 555 0100"
          />
        </Field>

        <div>
          <Label className="mb-1.5 inline-flex items-center gap-1">Your payout wallet</Label>
          <div className="border-border bg-muted/30 flex items-center rounded-md border px-3 py-2 font-mono text-xs text-[#050020]">
            {payoutAddress || 'Preparing your Strimz-embedded wallet…'}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            USDC settlements arrive here. You can route payouts to a treasury or Safe later from
            Settings, with a 24-hour on-chain safety delay.
          </p>
        </div>

        <SubmitButton
          type="submit"
          isLoading={submitting}
          loadingText="Saving…"
          disabled={!payoutAddress}
        >
          Complete onboarding
          <ArrowRight className="size-4" />
        </SubmitButton>
      </form>
    </div>
  )
}

function Field({
  label,
  children,
  required,
  help,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  help?: string
}) {
  return (
    <div>
      <Label className="mb-1.5 inline-flex items-center gap-1">
        {label}
        {required && <span className="text-[#02C76A]">*</span>}
      </Label>
      {children}
      {help && <p className="text-muted-foreground mt-1 text-xs">{help}</p>}
    </div>
  )
}
