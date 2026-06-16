'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Card, CardContent, Input, Label } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { SubmitButton } from '@/components/auth/submit-button'
import { useOnboardMerchant } from '@/hooks/api/use-merchant'

const SECTORS = [
  'SaaS',
  'E-commerce',
  'Marketplace',
  'Media & content',
  'Financial services',
  'Other',
] as const

export default function OnboardingPage() {
  const router = useRouter()
  const onboard = useOnboardMerchant()
  const [form, setForm] = useState({
    businessName: '',
    businessSector: SECTORS[0] as (typeof SECTORS)[number],
    countryCode: '',
    websiteUrl: '',
    phone: '',
    payoutAddress: '',
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await onboard.mutateAsync({
        businessName: form.businessName,
        businessSector: form.businessSector,
        countryCode: form.countryCode,
        payoutAddress: form.payoutAddress as `0x${string}`,
        // Empty strings are not valid URLs / phone numbers; let the API
        // see `undefined` instead so the optional schema accepts them.
        websiteUrl: form.websiteUrl || undefined,
        phone: form.phone || undefined,
      })
      router.push('/app')
    } catch {
      // Error toast is handled inside useMutationWithToast; nothing extra
      // to do here — the form stays on screen so the merchant can retry.
    }
  }

  return (
    <>
      <PageHeader
        title="Tell us about your business"
        description="Powers your dashboard, your storefront, and your live-mode eligibility."
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-[#02C76A]/10 px-2 py-0.5 text-xs font-medium text-[#02C76A]">
            <Sparkles className="size-3" />
            Self-attested
          </span>
        }
      />

      <Card className="shadow-sub-card border-border/60 max-w-2xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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

            <Field label="Payout wallet address" required help="USDC settlements arrive here.">
              <Input
                value={form.payoutAddress}
                onChange={(e) => setForm((f) => ({ ...f, payoutAddress: e.target.value }))}
                placeholder="0x…"
                pattern="^0x[a-fA-F0-9]{40}$"
                required
              />
            </Field>

            <SubmitButton type="submit" isLoading={onboard.isPending} loadingText="Saving…">
              Complete onboarding
              <ArrowRight className="size-4" />
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
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
